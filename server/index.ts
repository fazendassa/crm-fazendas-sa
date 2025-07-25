import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import http from 'http';
import whatsappRouter from './routes/whatsapp.routes';
import dashboardRouter from './routes/dashboard.routes.ts';
import activitiesRouter from './routes/activities.routes.ts';
import { setupVite, serveStatic, log } from "./vite";
import cors from 'cors';

const app = express();

// Configuração do CORS para permitir apenas a URL do frontend
const corsOptions = {
  origin: 'https://crm-fazendas-sa-front-end.onrender.com',
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Register API routes before logging and static files
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/activities', activitiesRouter);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Test database connection before starting server
    const { testConnection } = await import("./db");
    console.log('Testing database connection...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.log('Warning: Starting server without database connection');
    }
    const server = http.createServer(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      // Não relance o erro aqui para evitar crashes desnecessários em produção
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      // In production, the backend is API-only. The frontend is served by a separate static site service.
      // We don't serve static files from the backend.
      app.get('*', (req, res) => {
        res.status(404).json({ message: 'Not Found' });
      });
    }

    // Use a porta do ambiente ou 3000 como padrão, e não 5000 hardcoded.
    const port = process.env.PORT || 3000;
    server.listen(port, () => {
      log(`🚀 Server running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('💥 Failed to start server:', error);
    process.exit(1);
  }
})();

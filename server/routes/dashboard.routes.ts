import { Router } from 'express';

const router = Router();

// Rota para buscar as métricas do dashboard
router.get('/metrics', async (req, res) => {
  try {
    // Lógica para buscar os dados do banco de dados virá aqui.
    // Por enquanto, retornamos dados de exemplo para desbloquear o frontend.
    const metrics = {
      totalContacts: 150,
      activeCompanies: 25,
      openDeals: 42,
      projectedRevenue: "120,500.00",
      stageMetrics: [
        { stage: 'prospeccao', count: 20, totalValue: 'R$ 50.000' },
        { stage: 'qualificacao', count: 10, totalValue: 'R$ 30.000' },
        { stage: 'proposta', count: 7, totalValue: 'R$ 25.500' },
        { stage: 'fechamento', count: 5, totalValue: 'R$ 15.000' },
      ],
    };

    res.json(metrics);
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    res.status(500).json({ message: 'Erro ao buscar métricas do dashboard' });
  }
});

export default router;

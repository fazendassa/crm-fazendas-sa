import { Router } from 'express';

const router = Router();

// Rota para buscar atividades recentes
router.get('/', async (req, res) => {
  try {
    // Lógica para buscar atividades do banco de dados virá aqui.
    // Por enquanto, retornamos um array vazio para desbloquear o frontend.
    res.json([]);
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    res.status(500).json({ message: 'Erro ao buscar atividades recentes' });
  }
});

export default router;

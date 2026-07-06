const { requireRole } = require("../../middleware/rbac");

function registerDashboardRoutes(router) {
  const dashboardService = require("../../services/dashboard.service");
  const analyticsService = require("../../services/analytics.service");
  const inventoryService = require("../../services/inventory.service");
  const auditLogService = require("../../services/auditLog.service");
  const settingsService = require("../../services/settings.service");

  router.get("/dashboard", requireRole("admin"), async (req, res) => {
    try {
      const stats = await dashboardService.getDashboardStats();
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/analytics", requireRole("admin"), async (req, res) => {
    try {
      const report = await analyticsService.getAnalyticsReport();
      res.json(report);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/inventory", requireRole("admin"), async (req, res) => {
    try {
      const counts = await inventoryService.getCountsByType();
      res.json(counts);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put("/inventory/:consoleType", requireRole("admin"), async (req, res) => {
    try {
      const { count } = req.body;
      const counts = await inventoryService.setCount(req.params.consoleType, count, {
        telegramId: req.auth?.telegramId,
        adminId: req.auth?.adminId,
      });
      res.json(counts);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get("/settings/delivery-fee", requireRole("admin"), async (req, res) => {
    try {
      const fee = await settingsService.getDeliveryFee();
      res.json({ deliveryFee: fee });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put("/settings/delivery-fee", requireRole("admin"), async (req, res) => {
    try {
      const fee = await settingsService.setDeliveryFee(req.body.deliveryFee, {
        telegramId: req.auth?.telegramId,
        adminId: req.auth?.adminId,
      });
      res.json({ deliveryFee: fee });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get("/audit-logs", requireRole("admin"), async (req, res) => {
    try {
      const logs = await auditLogService.recent(Number(req.query.limit) || 50);
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = { registerDashboardRoutes };

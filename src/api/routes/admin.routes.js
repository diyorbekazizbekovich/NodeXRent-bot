const express = require("express");
const router = express.Router();
const reportService = require("../../services/report.service");
const { requireRole } = require("../../middleware/rbac");
const { registerDashboardRoutes } = require("./admin.dashboard.routes");
const { registerInventoryAssetRoutes } = require("./admin.inventory.routes");

registerInventoryAssetRoutes(router);
registerDashboardRoutes(router);

router.get("/stats", requireRole("admin"), async (req, res) => {
  try {
    const stats = await reportService.generalStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/stats/daily", requireRole("admin"), async (req, res) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const summary = await reportService.dailySummary(date);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/stats/top-couriers", requireRole("admin"), async (req, res) => {
  try {
    const top = await reportService.topCouriers();
    res.json(top);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

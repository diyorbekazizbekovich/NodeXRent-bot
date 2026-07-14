const express = require("express");
const inventoryAssetService = require("../../services/inventoryAsset.service");
const { InventoryAssetError } = require("../../services/inventoryAsset.service");
const { requireRole } = require("../../middleware/rbac");

function mapError(res, err) {
  if (err instanceof InventoryAssetError) {
    const status =
      err.code === "NOT_FOUND"
        ? 404
        : err.code === "INVALID_TRANSITION" ||
            err.code === "DELETE_FORBIDDEN" ||
            err.code === "DUPLICATE_SERIAL" ||
            err.code === "DUPLICATE_ASSET_CODE" ||
            err.code === "INVALID_MODEL"
          ? 400
          : 400;
    return res.status(status).json({ error: err.message, code: err.code });
  }
  return res.status(500).json({ error: err.message });
}

/**
 * Inventory asset APIs (physical console management).
 * Mounted under /api/admin
 */
function registerInventoryAssetRoutes(router) {
  /** Dynamic statistics per model */
  router.get("/inventory/statistics", requireRole("admin"), async (req, res) => {
    try {
      const stats = await inventoryAssetService.getStatistics({
        model: req.query.model || req.query.consoleType,
      });
      res.json(stats);
    } catch (err) {
      mapError(res, err);
    }
  });

  /** List / filter / search */
  router.get("/inventory/assets", requireRole("admin"), async (req, res) => {
    try {
      const result = await inventoryAssetService.listAssets({
        model: req.query.model || req.query.consoleType,
        status: req.query.status,
        search: req.query.search || req.query.q,
        sort: req.query.sort || "newest",
        page: req.query.page,
        limit: req.query.limit,
      });
      res.json(result);
    } catch (err) {
      mapError(res, err);
    }
  });

  /** Available units lookup (for assignment UIs) */
  router.get("/inventory/available", requireRole("admin"), async (req, res) => {
    try {
      const items = await inventoryAssetService.listAvailable({
        model: req.query.model || req.query.consoleType,
      });
      res.json({ items });
    } catch (err) {
      mapError(res, err);
    }
  });

  /** Create asset */
  router.post("/inventory/assets", requireRole("admin"), async (req, res) => {
    try {
      const asset = await inventoryAssetService.createAsset(req.body, {
        adminId: req.auth?.adminId,
        telegramId: req.auth?.telegramId,
      });
      res.status(201).json(asset);
    } catch (err) {
      mapError(res, err);
    }
  });

  /** Asset details */
  router.get("/inventory/assets/:id", requireRole("admin"), async (req, res) => {
    try {
      const details = await inventoryAssetService.getAssetDetails(req.params.id);
      res.json(details);
    } catch (err) {
      mapError(res, err);
    }
  });

  /** Update asset fields */
  router.put("/inventory/assets/:id", requireRole("admin"), async (req, res) => {
    try {
      const asset = await inventoryAssetService.updateAsset(req.params.id, req.body, {
        adminId: req.auth?.adminId,
        telegramId: req.auth?.telegramId,
      });
      res.json(asset);
    } catch (err) {
      mapError(res, err);
    }
  });

  /** Change status (validated transitions) */
  router.post("/inventory/assets/:id/status", requireRole("admin"), async (req, res) => {
    try {
      const { status, note } = req.body;
      if (!status) {
        return res.status(400).json({ error: "status majburiy", code: "VALIDATION" });
      }
      const unit = await inventoryAssetService.changeStatus(req.params.id, status, {
        note,
        actorType: "admin",
        actorId: req.auth?.adminId,
        action: "STATUS_CHANGED",
      });
      res.json(inventoryAssetService.toDto(unit));
    } catch (err) {
      mapError(res, err);
    }
  });

  /** History */
  router.get("/inventory/assets/:id/history", requireRole("admin"), async (req, res) => {
    try {
      const history = await inventoryAssetService.getAssetHistory(req.params.id, {
        limit: req.query.limit,
      });
      res.json({ history });
    } catch (err) {
      mapError(res, err);
    }
  });

  /**
   * Delete / disable:
   * - default: DISABLED (soft)
   * - ?hard=true: permanent delete only if AVAILABLE
   */
  router.delete("/inventory/assets/:id", requireRole("admin"), async (req, res) => {
    try {
      const hard = String(req.query.hard || "") === "true";
      const result = await inventoryAssetService.deleteAsset(req.params.id, {
        hard,
        adminContext: {
          adminId: req.auth?.adminId,
          telegramId: req.auth?.telegramId,
        },
      });
      res.json(result);
    } catch (err) {
      mapError(res, err);
    }
  });
}

module.exports = { registerInventoryAssetRoutes };

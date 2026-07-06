const express = require("express");
const pricingService = require("../../services/pricing.service");
const { PricingError } = require("../../errors/pricing.errors");

const router = express.Router();

function handlePricingError(err, res) {
  if (err instanceof PricingError) {
    const status =
      err.code === "PRICE_NOT_FOUND" || err.code === "CONSOLE_NOT_FOUND" ? 404 : 400;
    return res.status(status).json({ error: err.code, message: err.message });
  }
  return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
}

/** Barcha faol konsol turlari */
router.get("/consoles", async (req, res) => {
  try {
    const consoles = await pricingService.listActiveConsoles();
    res.json(consoles);
  } catch (err) {
    handlePricingError(err, res);
  }
});

/** Tanlangan konsol uchun barcha ijara variantlari */
router.get("/:consoleType/options", async (req, res) => {
  try {
    const options = await pricingService.getAvailableRentalOptions(req.params.consoleType);
    res.json(options);
  } catch (err) {
    handlePricingError(err, res);
  }
});

/** Aniq narx: GET /api/pricing/PS5/72 */
router.get("/:consoleType/:duration", async (req, res) => {
  try {
    const price = await pricingService.getRentalPrice(
      req.params.consoleType,
      req.params.duration
    );
    res.json(price);
  } catch (err) {
    handlePricingError(err, res);
  }
});

module.exports = router;

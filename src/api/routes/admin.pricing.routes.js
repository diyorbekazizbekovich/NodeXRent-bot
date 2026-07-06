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

router.get("/", async (req, res) => {
  try {
    const includeInactive = req.query.all === "true";
    const prices = await pricingService.listAllRentalPrices({ includeInactive });
    res.json(prices);
  } catch (err) {
    handlePricingError(err, res);
  }
});

router.get("/consoles", async (req, res) => {
  try {
    const consoles = await pricingService.listAllConsolesWithPrices();
    res.json(consoles);
  } catch (err) {
    handlePricingError(err, res);
  }
});

router.post("/consoles", async (req, res) => {
  try {
    const { code, displayName, sortOrder } = req.body;
    const consoleType = await pricingService.createConsoleType({ code, displayName, sortOrder });
    res.status(201).json(consoleType);
  } catch (err) {
    handlePricingError(err, res);
  }
});

router.patch("/consoles/:id", async (req, res) => {
  try {
    const updated = await pricingService.updateConsoleType(Number(req.params.id), req.body);
    res.json(updated);
  } catch (err) {
    handlePricingError(err, res);
  }
});

router.post("/", async (req, res) => {
  try {
    const { consoleType, duration, price, currency } = req.body;
    const created = await pricingService.createRentalPriceOption({
      consoleType,
      duration,
      price,
      currency,
    });
    res.status(201).json(created);
  } catch (err) {
    handlePricingError(err, res);
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const updated = await pricingService.updateRentalPriceOption(Number(req.params.id), req.body);
    res.json(updated);
  } catch (err) {
    handlePricingError(err, res);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await pricingService.deleteRentalPriceOption(Number(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    handlePricingError(err, res);
  }
});

module.exports = router;

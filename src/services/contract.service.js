const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { formatDatetime } = require("../utils/dateHelper");
const { labelCollateral, labelHandoverPayment } = require("../constants/deliveryHandover");
const { labelCondition } = require("../constants/inventoryItem");

const CONTRACTS_DIR = path.join(process.cwd(), "uploads", "contracts");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function nextContractNumber(orderId) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `NX-${y}${m}${day}-${String(orderId).padStart(5, "0")}`;
}

function money(n) {
  return `${Number(n || 0).toLocaleString("uz-UZ")} so'm`;
}

/**
 * @returns {Promise<{ contractNumber: string, pdfPath: string, payload: object }>}
 */
async function generateContractPdf(order, meta) {
  ensureDir(CONTRACTS_DIR);
  const contractNumber = nextContractNumber(order.id);
  const pdfPath = path.join(CONTRACTS_DIR, `contract-${order.id}-${Date.now()}.pdf`);

  const joysticks = (meta.joysticks || []).map((j) => j.inventoryNumber).join(", ");
  const payload = {
    contractNumber,
    orderId: order.id,
    customer: {
      fullName: order.user?.fullName || "—",
      phone: order.user?.phone || "—",
      address: order.address || "—",
    },
    console: {
      inventoryNumber: meta.console?.inventoryNumber,
      serialNumber: meta.console?.serialNumber,
      consoleType: meta.console?.consoleType || order.consoleType,
    },
    joysticks: (meta.joysticks || []).map((j) => ({
      inventoryNumber: j.inventoryNumber,
      serialNumber: j.serialNumber,
    })),
    hdmi: meta.hdmi
      ? { inventoryNumber: meta.hdmi.inventoryNumber, serialNumber: meta.hdmi.serialNumber }
      : null,
    power: meta.power
      ? { inventoryNumber: meta.power.inventoryNumber, serialNumber: meta.power.serialNumber }
      : null,
    rental: {
      start: formatDatetime(order.startDatetime),
      end: formatDatetime(order.endDatetime),
      basePrice: meta.basePrice,
      discount: meta.discount,
      finalPaidAmount: meta.finalPaidAmount,
      paymentMethod: meta.paymentMethod,
      collateralType: meta.collateralType,
    },
    courier: order.courier?.fullName || "—",
    deliveredAt: formatDatetime(meta.deliveredAt || new Date()),
  };

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    doc.fontSize(18).text("IJARA SHARTNOMASI / RENTAL CONTRACT", { align: "center" });
    doc.moveDown();
    doc.fontSize(11);
    doc.text(`Shartnoma raqami: ${contractNumber}`);
    doc.text(`Buyurtma: #${order.id}`);
    doc.moveDown();

    doc.fontSize(13).text("1. Mijoz", { underline: true });
    doc.fontSize(11);
    doc.text(`Ism: ${payload.customer.fullName}`);
    doc.text(`Telefon: ${payload.customer.phone}`);
    doc.text(`Manzil: ${payload.customer.address}`);
    doc.moveDown();

    doc.fontSize(13).text("2. PlayStation", { underline: true });
    doc.fontSize(11);
    doc.text(`Tur: ${payload.console.consoleType}`);
    doc.text(`Inventory Number: ${payload.console.inventoryNumber}`);
    doc.text(`Serial Number: ${payload.console.serialNumber}`);
    doc.moveDown();

    doc.fontSize(13).text("3. Aksessuarlar", { underline: true });
    doc.fontSize(11);
    doc.text(`Joysticklar (4): ${joysticks}`);
    doc.text(`HDMI: ${payload.hdmi?.inventoryNumber || "—"}`);
    doc.text(`Power: ${payload.power?.inventoryNumber || "—"}`);
    doc.moveDown();

    doc.fontSize(13).text("4. Ijara shartlari", { underline: true });
    doc.fontSize(11);
    doc.text(`Boshlanish: ${payload.rental.start}`);
    doc.text(`Tugash: ${payload.rental.end}`);
    doc.text(`Asl narx: ${money(payload.rental.basePrice)}`);
    doc.text(`Promo chegirma: ${money(payload.rental.discount)}`);
    doc.text(`Yakuniy summa: ${money(payload.rental.finalPaidAmount)}`);
    doc.text(`To'lov usuli: ${labelHandoverPayment(payload.rental.paymentMethod)}`);
    doc.text(`Garov hujjati: ${labelCollateral(payload.rental.collateralType)}`);
    doc.moveDown();

    doc.fontSize(13).text("5. Topshirish", { underline: true });
    doc.fontSize(11);
    doc.text(`Kuryer: ${payload.courier}`);
    doc.text(`Topshirish vaqti: ${payload.deliveredAt}`);
    doc.moveDown(2);

    doc.fontSize(10).text(
      "Ushbu elektron shartnoma topshirish vaqtida mijoz va kuryer ishtirokida tuzilgan. " +
        "Qurilma va aksessuarlar yuqoridagi inventar raqamlari bilan topshirilgan.",
      { align: "justify" }
    );
    doc.moveDown(2);
    doc.text("Mijoz imzosi: ______________          Kuryer imzosi: ______________");

    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return { contractNumber, pdfPath, payload };
}

module.exports = {
  generateContractPdf,
  nextContractNumber,
  CONTRACTS_DIR,
  labelCondition,
};

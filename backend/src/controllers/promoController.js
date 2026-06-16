const PromoCode = require('../models/PromoCode');

// POST /api/promo/validate  — User promokodni tekshiradi
exports.validatePromoCode = async (req, res) => {
  try {
    const { code, service = 'taxi' } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Promokod kiritilmadi' });
    }

    const promo = await PromoCode.findOne({ code: code.trim().toUpperCase() });

    if (!promo) {
      return res.status(404).json({ success: false, message: 'Promokod topilmadi' });
    }

    if (!promo.isActive) {
      return res.status(400).json({ success: false, message: 'Bu promokod faol emas' });
    }

    if (promo.expiresAt && new Date() > promo.expiresAt) {
      return res.status(400).json({ success: false, message: 'Promokod muddati tugagan' });
    }

    if (promo.usedCount >= promo.maxUses) {
      return res.status(400).json({ success: false, message: 'Promokod foydalanish limiti tugagan' });
    }

    if (promo.service !== 'all' && promo.service !== service) {
      const serviceNames = { taxi: 'taksi', eats: 'taom yetkazish' };
      return res.status(400).json({
        success: false,
        message: `Bu promokod faqat ${serviceNames[promo.service]} uchun`,
      });
    }

    return res.status(200).json({
      success: true,
      discount: promo.discount,
      code: promo.code,
      service: promo.service,
      message: `Promokod qo'llanildi! ${promo.discount}% chegirma`,
    });
  } catch (error) {
    console.error('Validate promo error:', error);
    return res.status(500).json({ success: false, message: 'Promokodni tekshirishda xatolik' });
  }
};

// ===== ADMIN PROMO CRUD =====

// GET /api/admin/promo
exports.getPromoCodes = async (req, res) => {
  try {
    const promos = await PromoCode.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, promos });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/admin/promo
exports.createPromoCode = async (req, res) => {
  try {
    const { code, discount, maxUses, isActive, service, expiresAt } = req.body;

    if (!code || !discount) {
      return res.status(400).json({ success: false, message: 'Kod va chegirma foizi kiritilishi shart' });
    }

    const existing = await PromoCode.findOne({ code: code.trim().toUpperCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Bu kod allaqachon mavjud' });
    }

    const promo = await PromoCode.create({
      code: code.trim().toUpperCase(),
      discount: Number(discount),
      maxUses: maxUses ? Number(maxUses) : 100,
      isActive: isActive !== false,
      service: service || 'all',
      expiresAt: expiresAt || null,
    });

    return res.status(201).json({ success: true, promo });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/admin/promo/:id/toggle
exports.togglePromoCode = async (req, res) => {
  try {
    const { id } = req.params;
    const promo = await PromoCode.findById(id);
    if (!promo) return res.status(404).json({ success: false, message: 'Promokod topilmadi' });

    promo.isActive = !promo.isActive;
    await promo.save();

    return res.status(200).json({ success: true, promo });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/admin/promo/:id
exports.deletePromoCode = async (req, res) => {
  try {
    const { id } = req.params;
    await PromoCode.findByIdAndDelete(id);
    return res.status(200).json({ success: true, message: 'Promokod o\'chirildi' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

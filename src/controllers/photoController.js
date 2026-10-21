const photoService = require('../services/photoService');

const capturePhoto = async (req, res, next) => {
  try {
    const photo = await photoService.capturePhoto(req.user.id, req.body, req.file);
    res.status(201).json({ success: true, data: photo });
  } catch (error) {
    next(error);
  }
};

const getPhotos = async (req, res, next) => {
  try {
    const filters = { ...req.query };
    if (req.user.role === 'employee') {
      filters.employeeId = req.user.id;
    }
    const result = await photoService.getPhotos(filters);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const getPhotoById = async (req, res, next) => {
  try {
    const photo = await photoService.getPhotoById(req.params.id);
    if (req.user.role === 'employee' && photo.employeeId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    res.json({ success: true, data: photo });
  } catch (error) {
    next(error);
  }
};

const getShopVisits = async (req, res, next) => {
  try {
    const filters = { ...req.query };
    if (req.user.role === 'employee') {
      filters.employeeId = req.user.id;
    }
    const result = await photoService.getShopVisits(filters);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = { capturePhoto, getPhotos, getPhotoById, getShopVisits };

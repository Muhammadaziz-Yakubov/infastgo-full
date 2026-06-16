const mongoose = require('mongoose');

const placeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String, default: '' },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  type: { type: String, default: 'point' },
  radius: { type: Number, default: 0 },
  points: [{
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  }],
}, {
  timestamps: false,
});

// Index for text search on name and address
placeSchema.index({ name: 'text', address: 'text' });

// Regular index for geospatial-style queries
placeSchema.index({ 'location.lat': 1, 'location.lng': 1 });

module.exports = mongoose.model('Place', placeSchema);

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const helmet = require('helmet');

// Load environment variables
dotenv.config();

const authRoutes = require('./routes/authRoutes');
const rideRoutes = require('./routes/rideRoutes');
const adminRoutes = require('./routes/adminRoutes');
const placesRoutes = require('./routes/placesRoutes');
const voiceOrderRoutes = require('./voice-order/routes/voiceOrderRoutes');
const driverRoutes = require('./routes/driverRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const foodRoutes = require('./routes/foodRoutes');
const courierRoutes = require('./routes/courierRoutes');
const eatsRestaurantRoutes = require('./routes/eatsRestaurantRoutes');
const eatsCourierRoutes = require('./routes/eatsCourierRoutes');
const eatsOrderRoutes = require('./routes/eatsOrderRoutes');
const walletRoutes = require('./routes/walletRoutes');
const promoRoutes = require('./routes/promoRoutes');
const socketService = require('./services/socketService');
const { socketAuthMiddleware } = require('./middleware/authMiddleware');
const { generalLimiter } = require('./middleware/rateLimiter');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');

const User = require('./models/User');
const Driver = require('./models/Driver');
const Config = require('./models/Config');
const Place = require('./models/Place');
const Store = require('./models/Store');
const Courier = require('./models/Courier');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io with JWT authentication
const io = socketService.init(server);
io.use(socketAuthMiddleware);

// Middleware
app.use(helmet({ contentSecurityPolicy: false })); // Security headers
app.use(cors());
app.use(express.json());
app.use(generalLimiter); // Global API rate limiting
app.use('/images', express.static(path.join(__dirname, '../public/images')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/places', placesRoutes);
app.use('/api/voice-order', voiceOrderRoutes);
app.use('/api/driver', driverRoutes);
app.use('/payments', paymentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/food', foodRoutes);
app.use('/api/courier', courierRoutes);
app.use('/api/eats/restaurant', eatsRestaurantRoutes);
app.use('/api/eats/courier', eatsCourierRoutes);
app.use('/api/eats', eatsOrderRoutes);
app.use('/api/eats/wallet', walletRoutes);
app.use('/api/promo', promoRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Dev Utility: Seeding route
app.post('/api/seed', async (req, res) => {
  try {
    // 1. Seed initial pricing config (upsert to overwrite/update structure)
    const config = await Config.findOneAndUpdate(
      { key: 'pricing' },
      {
        $set: {
          tariffs: {
            standart: { baseFare: 5000, pricePerKm: 1500 },
            komfort: { baseFare: 7000, pricePerKm: 2000 },
            biznes: { baseFare: 10000, pricePerKm: 3000 },
          },
          surgeMultiplier: 1.0,
        }
      },
      { upsert: true, new: true }
    );

    // 2. Seed Admin User (upsert: creates if missing, upgrades role if exists)
    const admin = await User.findOneAndUpdate(
      { phone: '+998902710027' },
      { $set: { name: 'Muhammadaziz', surname: 'Yakubov', role: 'admin' } },
      { upsert: true, new: true }
    );

    // 3. Seed Places from places_export.json
    let placesSeeded = 0;
    try {
      await Place.deleteMany({});
      const placesData = require('../places_export.json');
      const placesToInsert = placesData
        .filter(p => p.location && p.location.lat && p.location.lng && p.name)
        .map(p => ({
          name: p.name,
          address: p.address || '',
          location: { lat: p.location.lat, lng: p.location.lng },
          type: p.type || 'point',
          radius: p.radius || 0,
          points: p.points || [],
        }));
      await Place.insertMany(placesToInsert, { ordered: false });
      placesSeeded = placesToInsert.length;
      console.log(`Seeded ${placesSeeded} places.`);
    } catch (placesErr) {
      console.warn('Places seeding warning:', placesErr.message);
    }

    // 4. Seed Stores
    await Store.deleteMany({});
    const storeOwner = await User.findOneAndUpdate(
      { phone: '+998901111111' },
      { $set: { name: 'Restoran', surname: 'Xo\'jayini', role: 'store' } },
      { upsert: true, new: true }
    );

    await Store.create([
      {
        ownerUserId: storeOwner._id,
        name: 'MaxWay Fast Food',
        category: 'Burger, Lavash, Kartoshka',
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=500&q=80',
        location: { lat: 41.3146, lng: 69.2435 },
        isActive: true,
        menu: [
          { name: 'Klassik Lavash', price: 28000, description: 'Mol go\'shti, chipslar, barra pomidor va maxsus sous.' },
          { name: 'Chizburger Max', price: 24000, description: 'Shirali kotlet, cheddar pishlog\'i, tuzlangan bodring.' },
          { name: 'Klab Sendvich', price: 26000, description: 'Tovuq filesi, pishloq, kurka go\'shti, kartoshka fri bilan.' },
        ]
      },
      {
        ownerUserId: storeOwner._id,
        name: 'KFC Milliy',
        category: 'Tovuq, Burger, Fri',
        image: 'https://images.unsplash.com/photo-1513639776629-7b61b0ac5987?auto=format&fit=crop&w=500&q=80',
        location: { lat: 41.3268, lng: 69.2285 },
        isActive: true,
        menu: [
          { name: 'Shefburger achchiq', price: 25000, description: 'Achchiq tutilgan tovuq filesi, salat bargi, sous.' },
          { name: 'Kichik korzina', price: 54000, description: '9 dona tovuq qanotchalari va maxsus sous.' },
          { name: 'Kartoshka Fri', price: 12000, description: 'Oltinrang qarsillaydigan kartoshka fri.' },
        ]
      }
    ]);

    return res.status(200).json({
      success: true,
      message: `Demo ma'lumotlar muvaffaqiyatli yuklandi! ${placesSeeded} manzil va restoranlar mavjud.`,
      placesCount: placesSeeded,
    });
  } catch (error) {
    console.error('Seeding error:', error);
    return res.status(500).json({ success: false, message: 'Seeding failed', error: error.message });
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'running', service: 'InFast Go API', time: new Date() });
});

// Database Connection & Server Startup
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/infast_go';

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB connection established successfully.');
    // Start background matching loop for eats couriers
    const courierMatchService = require('./services/courierMatchService');
    courierMatchService.startMatchingLoop();
    
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection failure:', err.message);
    console.log('Starting server in offline database backup mode...');
    // Start server anyway for API mocking and layout testing if DB is not running
    server.listen(PORT, () => {
      console.log(`Server running without database on port ${PORT}`);
    });
  });

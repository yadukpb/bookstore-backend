const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2;

const app = express();
require('dotenv').config();

app.use(cors());
app.use(express.json());

const PORT = 5007;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
//const MONGODB_URI = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@book-store.z2mz8.mongodb.net/?retryWrites=true&w=majority`;

const MONGODB_URI = process.env.MONGO_URI ;

// Cloudinary configuration
cloudinary.config({
  cloud_name: 'dsooac8hy',
  api_key: '157549627848816',
  api_secret: 'AqNgFGvkeLWcMnqKVngNG1aew5I'
});

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  image: { type: String },
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book' }],
  verified: { type: Boolean, default: false },
  location: { type: String },
  telegram: { type: String },
  role: { type: String, enum: ['user', 'admin', 'seller'], default: 'user' }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

const bookSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  mrp: { type: Number, required: true },
  edition: { type: Number, required: true },
  publisher: { type: String, required: true },
  category: { type: String, required: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookFront: { type: String, required: true },
  bookBack: { type: String, required: true },
  bookIndex: { type: String, required: true },
  bookMiddle: { type: String, required: true }
}, { timestamps: true });

const Book = mongoose.model('Book', bookSchema);

const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  amount: { type: Number, required: true },
  paymentMethod: { type: String, required: true },
  status: { type: String, enum: ['completed', 'pending', 'failed'], default: 'completed' },
  timestamp: { type: Date, default: Date.now }
});

const Payment = mongoose.model('Payment', paymentSchema);

const chatSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  messages: [{
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: String,
    timestamp: { type: Date, default: Date.now },
    status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' }
  }],
  lastMessage: {
    text: String,
    timestamp: Date,
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  unreadCount: { type: Number, default: 0 }
}, { timestamps: true });

const Chat = mongoose.model('Chat', chatSchema);

const purchaseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true },
  status: { type: String, enum: ['completed', 'pending', 'failed'], default: 'completed' },
  timestamp: { type: Date, default: Date.now }
});

const Purchase = mongoose.model('Purchase', purchaseSchema);

const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
};

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        verified: user.verified,
        wishlist: user.wishlist,
        telegram: user.telegram,
        location: user.location
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during login' });
  }
});


app.get('/api/auth/verify', verifyToken, (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    console.log('Signup attempt for email:', email);

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role: 'user'
    });

    await user.save();
    console.log('New user created:', user._id);

    const token = generateToken(user);
    user.refreshToken = token;
    await user.save();

    res.status(201).json({
      message: 'User created successfully',
      user: { id: user._id, name, email, role: user.role },
      token
    });
  } catch (error) {
    console.error('Signup error details:', error);
    res.status(500).json({ message: 'Server error during signup' });
  }
});

app.post('/api/users/become-seller', verifyToken, async (req, res) => {
  try {
    const { telegram, location } = req.body;
    
    if (!telegram || !location) {
      return res.status(400).json({ message: 'Telegram and location are required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.verified) {
      return res.status(400).json({ message: 'User is already a verified seller' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        role: 'seller',
        verified: true,
        telegram: telegram,
        location: location
      },
      { new: true }
    );

    const token = generateToken(updatedUser);
    
    res.json({ 
      message: 'Successfully became a seller',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        verified: updatedUser.verified,
        telegram: updatedUser.telegram,
        location: updatedUser.location
      },
      token
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error while updating seller status' });
  }
});

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/upload', verifyToken, upload.fields([
  { name: 'bookFront', maxCount: 1 },
  { name: 'bookBack', maxCount: 1 },
  { name: 'bookIndex', maxCount: 1 },
  { name: 'bookMiddle', maxCount: 1 }
]), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user || !user.verified || user.role !== 'seller') {
      return res.status(403).json({ message: 'Only verified sellers can upload images' });
    }

    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const urls = {};
    for (const fieldName of ['bookFront', 'bookBack', 'bookIndex', 'bookMiddle']) {
      if (!req.files[fieldName]) {
        return res.status(400).json({ message: `Missing ${fieldName} image` });
      }

      const file = req.files[fieldName][0];
      const b64 = Buffer.from(file.buffer).toString('base64');
      const dataURI = `data:${file.mimetype};base64,${b64}`;

      try {
        const result = await cloudinary.uploader.upload(dataURI, {
          folder: 'books',
          resource_type: 'image',
          transformation: [{
            width: 800,
            height: 800,
            crop: 'limit'
          }]
        });
        
        urls[fieldName] = result.secure_url;
      } catch (uploadError) {
        console.error(`Error uploading ${fieldName}:`, uploadError);
        return res.status(500).json({ 
          message: `Error uploading ${fieldName}`, 
          error: uploadError.message 
        });
      }
    }

    res.json({ urls });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      message: 'Error uploading files',
      error: error.message 
    });
  }
});

app.use('/uploads', express.static('uploads'))

app.post('/api/book', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user || !user.verified || user.role !== 'seller') {
      return res.status(403).json({ message: 'Only verified sellers can list books' });
    }

    const book = new Book({
      ...req.body,
      sellerId: req.user.id,
      category: req.body.category.toLowerCase()
    });

    await book.save();

    res.status(201).json({ 
      message: 'Book created successfully', 
      book 
    });
  } catch (error) {
    console.error('Book creation error:', error);
    res.status(500).json({ 
      message: 'Error creating book', 
      error: error.message 
    });
  }
});

app.get('/api/books/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const books = await Book.find({ 
      category: category.toLowerCase() 
    }).populate('sellerId', 'name location telegram');
    
    const formattedBooks = books.map(book => ({
      id: book._id,
      name: book.name,
      price: book.price,
      mrp: book.mrp,
      category: book.category,
      bookFront: book.bookFront,
      seller: {
        name: book.sellerId.name,
        location: book.sellerId.location,
        telegram: book.sellerId.telegram
      }
    }));
    
    res.json(formattedBooks);
  } catch (error) {
    console.error('Error fetching books by category:', error);
    res.status(500).json({ message: 'Error fetching books', error: error.message });
  }
});

app.post('/api/upload/profile', upload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    const b64 = Buffer.from(file.buffer).toString('base64');
    const dataURI = `data:${file.mimetype};base64,${b64}`;
    
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'profiles',
      transformation: [
        { width: 400, height: 400, crop: 'fill', gravity: 'face' },
        { quality: 'auto' },
        { fetch_format: 'auto' }
      ]
    });
    
    res.json({ url: result.secure_url });
  } catch (error) {
    console.error('Profile upload error:', error);
    res.status(500).json({ message: 'Error uploading profile image' });
  }
});

app.patch('/api/users/:userId/profile-image', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { imageUrl } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { image: imageUrl },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Profile image updated', user });
  } catch (error) {
    console.error('Error updating profile image:', error);
    res.status(500).json({ message: 'Server error while updating profile image' });
  }
});

app.post('/api/auth/logout', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user) {
      user.refreshToken = null;
      await user.save();
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error during logout' });
  }
});



app.get('/api/books/:bookId', verifyToken, async (req, res) => {
  try {
    const book = await Book.findById(req.params.bookId)
      .populate('sellerId', 'name location telegram image');
    
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    const userId = req.user ? req.user.id : null; // Get user ID if authenticated
    const purchase = userId ? await Purchase.findOne({ userId, bookId: book._id }) : null; // Check if the user has purchased the book

    const formattedBook = {
      id: book._id,
      name: book.name,
      description: book.description,
      price: book.price,
      mrp: book.mrp,
      edition: book.edition,
      publisher: book.publisher,
      category: book.category,
      bookFront: book.bookFront,
      bookBack: book.bookBack,
      bookIndex: book.bookIndex,
      bookMiddle: book.bookMiddle,
      seller: {
        id: book.sellerId._id,
        name: book.sellerId.name,
        location: book.sellerId.location,
        telegram: book.sellerId.telegram,
        image: book.sellerId.image
      },
      canChat: purchase !== null // Determine if the user can chat with the seller
    };

    res.json(formattedBook);
  } catch (error) {
    console.error('Error fetching book:', error);
    res.status(500).json({ message: 'Error fetching book details', error: error.message });
  }
});

app.post('/api/wishlist/add', verifyToken, async (req, res) => {
  try {
    const { bookId } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.wishlist.includes(bookId)) {
      user.wishlist.push(bookId);
      await user.save();
    }

    const updatedUser = await User.findById(userId).populate('wishlist');
    res.json({ wishlist: updatedUser.wishlist });
  } catch (error) {
    console.error('Add to wishlist error:', error);
    res.status(500).json({ message: 'Error updating wishlist' });
  }
});

app.post('/api/wishlist/remove', verifyToken, async (req, res) => {
  try {
    const { bookId } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.wishlist = user.wishlist.filter(id => id.toString() !== bookId);
    await user.save();

    const updatedUser = await User.findById(userId).populate('wishlist');
    res.json({ wishlist: updatedUser.wishlist });
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    res.status(500).json({ message: 'Error updating wishlist' });
  }
});

app.post('/api/payments', verifyToken, async (req, res) => {
  try {
    const { bookId, sellerId, amount, paymentMethod } = req.body;
    
    const payment = new Payment({
      userId: req.user.id,
      bookId,
      amount,
      paymentMethod,
      status: 'completed'
    });
    
    await payment.save();
    
    res.json({ 
      message: 'Payment successful',
      paymentId: payment._id
    });
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({ message: 'Payment failed' });
  }
});

app.get('/api/payments/check/:bookId', verifyToken, async (req, res) => {
  try {
    const payment = await Payment.findOne({
      userId: req.user.id,
      bookId: req.params.bookId,
      status: 'completed'
    });
    res.json({ paid: !!payment });
  } catch (error) {
    res.status(500).json({ message: 'Error checking payment status' });
  }
});

// Add this new endpoint
app.get('/api/auth/verify', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    res.json({ valid: true, user });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/users/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate({
        path: 'wishlist',
        select: 'name price bookFront _id'
      });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      image: user.image,
      verified: user.verified,
      telegram: user.telegram,
      location: user.location,
      wishlist: user.wishlist || [],
      bookToSell: user.bookToSell || []
    };

    res.json(userData);
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ 
      message: 'Error fetching user details',
      error: error.message 
    });
  }
});

app.get('/api/books', async (req, res) => {
  try {
    const books = await Book.find()
      .populate('sellerId', 'name location telegram');
    
    const formattedBooks = books.map(book => ({
      _id: book._id,
      name: book.name,
      description: book.description,
      price: book.price,
      mrp: book.mrp,
      edition: book.edition,
      publisher: book.publisher,
      category: book.category,
      bookFront: book.bookFront,
      bookBack: book.bookBack,
      bookIndex: book.bookIndex,
      bookMiddle: book.bookMiddle,
      seller: {
        id: book.sellerId._id,
        name: book.sellerId.name,
        location: book.sellerId.location,
        telegram: book.sellerId.telegram
      }
    }));
    
    res.json(formattedBooks);
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ message: 'Error fetching books', error: error.message });
  }
});

app.get('/api/chats', verifyToken, async (req, res) => {
  try {
    const chats = await Chat.find({ participants: req.user.id })
      .populate('participants', 'name image')
      .populate('lastMessage.sender', 'name')
      .sort({ updatedAt: -1 });
    
    res.json(chats);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching chats' });
  }
});

app.post('/api/chats/:chatId/messages', verifyToken, async (req, res) => {
  try {
    const { text } = req.body;
    const chat = await Chat.findById(req.params.chatId);
    
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    const newMessage = {
      sender: req.user.id,
      text,
      timestamp: new Date(),
      status: 'sent'
    };

    chat.messages.push(newMessage);
    chat.lastMessage = {
      text,
      timestamp: new Date(),
      sender: req.user.id
    };
    chat.unreadCount += 1;
    
    await chat.save();
    
    res.json(newMessage);
  } catch (error) {
    res.status(500).json({ message: 'Error sending message' });
  }
});

app.patch('/api/chats/:chatId/read', verifyToken, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });
    
    chat.unreadCount = 0;
    chat.messages = chat.messages.map(msg => ({
      ...msg,
      status: 'read'
    }));
    
    await chat.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error updating message status' });
  }
});

app.post('/api/payments', verifyToken, async (req, res) => {
  try {
    const { bookId, sellerId, amount, paymentMethod } = req.body;
    
    const payment = new Payment({
      userId: req.user.id,
      bookId,
      amount,
      paymentMethod,
      status: 'completed'
    });
    
    await payment.save();
    
    res.json({ 
      message: 'Payment successful',
      paymentId: payment._id
    });
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({ message: 'Payment failed' });
  }
});

app.get('/api/payments/verify/:sellerId', verifyToken, async (req, res) => {
  try {
    const payment = await Payment.findOne({
      userId: req.user.id,
      bookId: { $in: await Book.find({ sellerId: req.params.sellerId }).select('_id') },
      status: 'completed'
    });
    
    res.json({ hasPaid: !!payment });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying payment' });
  }
});

// Create new chat
app.post('/api/chats', verifyToken, async (req, res) => {
  try {
    const { participantId } = req.body;
    
    let chat = await Chat.findOne({
      participants: { $all: [req.user.id, participantId] }
    });

    if (!chat) {
      chat = new Chat({
        participants: [req.user.id, participantId],
        messages: []
      });
      await chat.save();
    }

    await chat.populate('participants', 'name image');
    res.json(chat);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create chat' });
  }
});

// Get user info
app.get('/api/users/:userId', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('name image');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch user info' });
  }
});

app.post('/api/books', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user || !user.verified || user.role !== 'seller') {
      return res.status(403).json({ message: 'Only verified sellers can list books' });
    }

    const bookData = {
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      mrp: req.body.mrp,
      edition: req.body.edition,
      publisher: req.body.publisher,
      category: req.body.category.toLowerCase(),
      bookFront: req.body.bookFront,
      bookBack: req.body.bookBack,
      bookIndex: req.body.bookIndex,
      bookMiddle: req.body.bookMiddle,
      sellerId: req.user.id
    };

    const book = new Book(bookData);
    await book.save();

    res.status(201).json({ 
      message: 'Book created successfully',
      book 
    });
  } catch (error) {
    console.error('Book creation error:', error);
    res.status(500).json({ 
      message: 'Error creating book',
      error: error.message 
    });
  }
});

app.post('/api/purchases', verifyToken, async (req, res) => {
  try {
    const { bookId, sellerId, amount, paymentId } = req.body;
    
    const purchase = new Purchase({
      userId: req.user.id,
      bookId,
      sellerId,
      amount,
      paymentId,
      status: 'completed'
    });

    await purchase.save();
    
    res.status(201).json({ 
      message: 'Purchase recorded successfully',
      purchase
    });
  } catch (error) {
    console.error('Purchase recording error:', error);
    res.status(500).json({ message: 'Failed to record purchase' });
  }
});

app.post('/api/wishlist/check', verifyToken, async (req, res) => {
    try {
        const { bookId } = req.body;
        const userId = req.user.id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const inWishlist = user.wishlist.includes(bookId);
        res.json({ inWishlist });
    } catch (error) {
        console.error('Check wishlist error:', error);
        res.status(500).json({ message: 'Error checking wishlist' });
    }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

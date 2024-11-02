const mongoose = require('mongoose');

const sellerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  verified: { type: Boolean, default: false },
  books: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book' }],
}, { timestamps: true });

const wishlistSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  books: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book' }],
}, { timestamps: true });

const adminSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, default: 'admin' },
}, { timestamps: true });

const bookSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  mrp: { type: Number, required: true },
  edition: { type: String, required: true },
  publisher: { type: String, required: true },
 // sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Removed required: true
  sellerId: {type:String},
  location: { type: String },
  pincode: { type: String },
  telegram: { type: String },
  bookFront: { type: String, required: true },
  bookBack: { type: String, required: true },
  bookMiddle: { type: String, required: true },
  bookIndex: { type: String, required: true },
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  image: { type: String },
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book' }],
  verified: { type: Boolean, default: false },
  location: { type: String },
  telegram: { type: String },
}, { timestamps: true });

module.exports = {
  Seller: mongoose.model('Seller', sellerSchema),
  Wishlist: mongoose.model('Wishlist', wishlistSchema),
  Admin: mongoose.model('Admin', adminSchema),
  Book: mongoose.model('Book', bookSchema),
  User: mongoose.model('User', userSchema),
};
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // Add this line
const dotenv = require('dotenv');
const { Book } = require('./model'); // Adjust the path as necessary

dotenv.config();

const app = express();
app.use(cors()); // Enable CORS for all origins
app.use(express.json()); // Middleware to parse JSON bodies

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// POST /api/book
app.post('/api/book', async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      price,
      mrp,
      edition,
      publisher,
      seller,
      sellerId,
      location,
      telegram,
      bookFront,
      bookBack,
      bookMiddle,
      bookIndex,
    } = req.body;

    console.log('Request body:', req.body); // Debugging: Log the request body

    if (!category || !seller) {
      console.error('Validation error: Missing category or seller'); // Debugging: Log validation error
      return res.status(400).json({ message: 'Category and seller are required.' });
    }

    const newBook = new Book({
      name,
      description,
      category,
      price,
      mrp,
      edition,
      publisher,
      seller,
      sellerId,
      location,
      telegram,
      bookFront: bookFront || '',
      bookBack: bookBack || '',
      bookMiddle: bookMiddle || '',
      bookIndex: bookIndex || '',
    });

    console.log('New book object:', newBook); // Debugging: Log the new book object

    await newBook.save();
    console.log('Book saved successfully:', newBook); // Debugging: Log success message
    res.status(201).json({ message: 'Book added successfully', book: newBook });
  } catch (error) {
    console.error('Error adding book:', error); // Debugging: Log the error
    res.status(500).json({ message: 'Error adding book', error });
  }
});

const PORT = process.env.PORT || 5007;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
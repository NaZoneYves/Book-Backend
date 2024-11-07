const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const { Schema } = mongoose;

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Kết nối MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("MongoDB connected"))
  .catch((error) => console.error("MongoDB connection error:", error));

// Model Book
const bookSchema = new Schema({
  title: String,
  author: String,
  genre: String,
  status: { type: String, default: 'available' },
  borrower: { type: String, default: null },
});

const Book = mongoose.model('Book', bookSchema);

// Model Borrow (Lịch sử mượn sách)
const borrowSchema = new Schema({
  bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
  userId: String,
  borrowDate: { type: Date, default: Date.now },
  returnDate: Date,
});

const Borrow = mongoose.model('Borrow', borrowSchema);

// Các API

// API thêm sách
app.post('/books', async (req, res) => {
  const book = new Book(req.body);
  await book.save();
  res.send(book);
});

// API lấy danh sách sách
app.get('/books', async (req, res) => {
  const books = await Book.find();
  res.send(books);
});

// API sửa thông tin sách
app.put('/books/:id', async (req, res) => {
  const book = await Book.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.send(book);
});

// API xóa sách
app.delete('/books/:id', async (req, res) => {
  await Book.findByIdAndDelete(req.params.id);
  res.send({ message: "Book deleted" });
});

// API mượn sách
app.post('/books/:id/borrow', async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (book.status === 'available') {
    book.status = 'borrowed';
    book.borrower = req.body.borrower;
    await book.save();

    // Lưu vào lịch sử mượn sách
    const borrow = new Borrow({
      bookId: book._id,
      userId: req.body.borrower,
    });
    await borrow.save();

    res.send(book);
  } else {
    res.status(400).send({ message: 'Book already borrowed' });
  }
});

// API trả sách
app.post('/books/:id/return', async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (book.status === 'borrowed') {
    book.status = 'available';
    book.borrower = null;
    await book.save();

    // Cập nhật ngày trả sách trong lịch sử
    await Borrow.findOneAndUpdate(
      { bookId: book._id, returnDate: null },
      { returnDate: new Date() }
    );

    res.send(book);
  } else {
    res.status(400).send({ message: 'Book is not borrowed' });
  }
});

// API để lấy tần suất mượn sách theo thể loại
app.get('/borrow-stats', async (req, res) => {
  try {
    const borrowStats = await Borrow.aggregate([
      {
        $lookup: {
          from: 'books', // Liên kết với collection "books"
          localField: 'bookId',
          foreignField: '_id',
          as: 'book'
        }
      },
      { $unwind: '$book' },
      {
        $group: {
          _id: '$book.genre', // Nhóm theo thể loại sách
          borrowCount: { $sum: 1 } // Đếm số lần mượn
        }
      },
      { $sort: { borrowCount: -1 } } // Sắp xếp giảm dần theo số lần mượn
    ]);
    res.json(borrowStats);
  } catch (error) {
    console.error('Error fetching borrow stats:', error);
    res.status(500).json({ message: 'Không thể lấy thống kê mượn sách.' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// blog_app/models/article.js
// blog_app/models/article.js
import mongoose from "mongoose";

const ArticleSchema = new mongoose.Schema({
  identifiant: {
    type: String,
    unique: true,
  },
  scenario: {
    type: String,
  },
  title: {
    type: String,
  },
  content: {
    type: String,
    required: true,
  },
  date: { 
    type: Date, 
    default: Date.now 
  },
});

const ArticleModel = mongoose.model("Article", ArticleSchema);
export default ArticleModel;


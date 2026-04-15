// TODO: FeedCatalogueBase - see FEED_CATALOGUE_BASE.md
import express from 'express';
import FeedItem from '../models/FeedItem.js';
import Business from '../models/Business.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const getOwnerId = (user) => user.createdBy || user._id;

router.get('/', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const { search, company, active, updatedSince } = req.query;

    const query = { user_id: ownerId };
    if (updatedSince) {
      query.updatedAt = { $gte: new Date(updatedSince) };
    } else {
      query.deletedAt = null;
    }

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [{ feedDescription: regex }];
    }

    if (company) {
      query.feedCompany = company;
    }

    if (active === 'true') {
      query.isActive = true;
    }

    const feedItems = await FeedItem.find(query)
      .populate('feedCompany', 'companyName')
      .sort({ createdAt: -1 });

    res.json(feedItems);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const feedItem = await FeedItem.findOne({
      _id: req.params.id,
      user_id: ownerId,
      deletedAt: null,
    })
      .populate('feedCompany', 'companyName')
      .populate('createdBy', 'firstName lastName');

    if (!feedItem) {
      return res.status(404).json({ message: 'Feed item not found' });
    }

    res.json(feedItem);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const {
      feedCompany,
      feedDescription,
      feedType,
      pricePerQty,
      quantitySize,
      quantityUnit,
      subtotal,
      vatAmount,
      grandTotal,
      isActive,
    } = req.body;

    if (!feedCompany || !feedDescription || !feedType) {
      return res.status(400).json({ message: 'Feed company, description, and type are required' });
    }

    const business = await Business.findOne({
      _id: feedCompany,
      user_id: ownerId,
      deletedAt: null,
    });
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    const feedItem = await FeedItem.create({
      user_id: ownerId,
      createdBy: req.user._id,
      feedCompany,
      feedDescription,
      feedType,
      pricePerQty: pricePerQty || 0,
      quantitySize: quantitySize ?? 50,
      quantityUnit: quantityUnit || 'KG',
      subtotal: subtotal || 0,
      vatAmount: vatAmount || 0,
      grandTotal: grandTotal || 0,
      isActive: isActive !== undefined ? isActive : true,
    });

    const populated = await FeedItem.findById(feedItem._id).populate(
      'feedCompany',
      'companyName'
    );

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const feedItem = await FeedItem.findOne({
      _id: req.params.id,
      user_id: ownerId,
      deletedAt: null,
    });

    if (!feedItem) {
      return res.status(404).json({ message: 'Feed item not found' });
    }

    const {
      feedCompany,
      feedDescription,
      feedType,
      pricePerQty,
      quantitySize,
      quantityUnit,
      subtotal,
      vatAmount,
      grandTotal,
      isActive,
    } = req.body;

    if (feedCompany !== undefined) {
      const business = await Business.findOne({
        _id: feedCompany,
        user_id: ownerId,
        deletedAt: null,
      });
      if (!business) {
        return res.status(404).json({ message: 'Business not found' });
      }
      feedItem.feedCompany = feedCompany;
    }
    if (feedDescription !== undefined) feedItem.feedDescription = feedDescription;
    if (feedType !== undefined) feedItem.feedType = feedType;
    if (pricePerQty !== undefined) feedItem.pricePerQty = pricePerQty;
    if (quantitySize !== undefined) feedItem.quantitySize = quantitySize;
    if (quantityUnit !== undefined) feedItem.quantityUnit = quantityUnit;
    if (subtotal !== undefined) feedItem.subtotal = subtotal;
    if (vatAmount !== undefined) feedItem.vatAmount = vatAmount;
    if (grandTotal !== undefined) feedItem.grandTotal = grandTotal;
    if (isActive !== undefined) feedItem.isActive = isActive;

    await feedItem.save();

    const populated = await FeedItem.findById(feedItem._id).populate(
      'feedCompany',
      'companyName'
    );

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const ownerId = getOwnerId(req.user);
    const feedItem = await FeedItem.findOne({
      _id: req.params.id,
      user_id: ownerId,
      deletedAt: null,
    });

    if (!feedItem) {
      return res.status(404).json({ message: 'Feed item not found' });
    }

    feedItem.deletedAt = new Date();
    await feedItem.save();

    res.json({ message: 'Feed item deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;

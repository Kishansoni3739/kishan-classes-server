import { asyncHandler } from "../utils/asyncHandler.js";

export const buildCrudController = (Model, options = {}) => {
  const populate = options.populate || [];
  const searchFields = options.searchFields || [];

  const applyScope = async (req, query) => {
    if (typeof options.scope === "function") {
      return await options.scope(req, query);
    }
    return query;
  };

  return {
    list: asyncHandler(async (req, res) => {
      const { search, page = 1, limit = 20, ...filters } = req.query;
      const query = {};

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== "" && value !== undefined) query[key] = value;
      });

      if (search && searchFields.length) {
        query.$or = searchFields.map((field) => ({ [field]: { $regex: search, $options: "i" } }));
      }

      const scopedQuery = await applyScope(req, query);
      const skip = (Number(page) - 1) * Number(limit);
      const [items, total] = await Promise.all([
        Model.find(scopedQuery)
          .populate(populate)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Math.min(Number(limit), 1000)),
        Model.countDocuments(scopedQuery)
      ]);

      res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) || 1 });
    }),

    get: asyncHandler(async (req, res) => {
      const item = await Model.findById(req.params.id).populate(populate);
      if (!item) {
        res.status(404);
        throw new Error("Record not found");
      }
      res.json(item);
    }),

    create: asyncHandler(async (req, res) => {
      const payload = typeof options.beforeCreate === "function" ? await options.beforeCreate(req) : req.body;
      const item = await Model.create(payload);
      res.status(201).json(await item.populate(populate));
    }),

    update: asyncHandler(async (req, res) => {
      const payload = typeof options.beforeUpdate === "function" ? await options.beforeUpdate(req) : req.body;
      const item = await Model.findByIdAndUpdate(req.params.id, payload, {
        new: true,
        runValidators: true
      }).populate(populate);

      if (!item) {
        res.status(404);
        throw new Error("Record not found");
      }

      res.json(item);
    }),

    remove: asyncHandler(async (req, res) => {
      const item = await Model.findByIdAndDelete(req.params.id);
      if (!item) {
        res.status(404);
        throw new Error("Record not found");
      }
      res.json({ message: "Record deleted" });
    }),

    removeMultiple: asyncHandler(async (req, res) => {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        res.status(400);
        throw new Error("No IDs provided");
      }

      if (typeof options.onRemoveMultiple === "function") {
        await options.onRemoveMultiple(req, res, ids);
        return;
      }

      await Model.deleteMany({ _id: { $in: ids } });
      res.json({ message: "Records deleted successfully" });
    })
  };
};

import { asyncHandler } from "../utils/asyncHandler.js";
import { WhatsAppTemplate } from "../models/WhatsAppTemplate.js";
import { defaultTemplates } from "./defaultTemplates.js";

// @desc    Get all WhatsApp templates
// @route   GET /api/whatsapp-templates
// @access  Admin
export const getTemplates = asyncHandler(async (req, res) => {
  const templates = await WhatsAppTemplate.find({}).sort({ isDefault: -1, name: 1 });
  res.json({ items: templates });
});

// @desc    Create a custom WhatsApp template
// @route   POST /api/whatsapp-templates
// @access  Admin
export const createTemplate = asyncHandler(async (req, res) => {
  const { name, category, messageBody, variables } = req.body;
  
  const templateExists = await WhatsAppTemplate.findOne({ name });
  if (templateExists) {
    res.status(400);
    throw new Error("Template with this name already exists");
  }
  
  const template = await WhatsAppTemplate.create({
    name,
    category,
    messageBody,
    variables,
    isDefault: false
  });
  
  res.status(201).json(template);
});

// @desc    Update a WhatsApp template
// @route   PUT /api/whatsapp-templates/:id
// @access  Admin
export const updateTemplate = asyncHandler(async (req, res) => {
  const template = await WhatsAppTemplate.findById(req.params.id);
  
  if (!template) {
    res.status(404);
    throw new Error("Template not found");
  }
  
  // Update fields
  template.messageBody = req.body.messageBody || template.messageBody;
  
  // Custom templates can have name, category, variables updated.
  // Default templates should preserve name and category.
  if (!template.isDefault) {
    template.name = req.body.name || template.name;
    template.category = req.body.category || template.category;
    if (req.body.variables) {
      template.variables = req.body.variables;
    }
  }
  
  const updatedTemplate = await template.save();
  res.json(updatedTemplate);
});

// @desc    Delete a custom WhatsApp template
// @route   DELETE /api/whatsapp-templates/:id
// @access  Admin
export const deleteTemplate = asyncHandler(async (req, res) => {
  const template = await WhatsAppTemplate.findById(req.params.id);
  
  if (!template) {
    res.status(404);
    throw new Error("Template not found");
  }
  
  if (template.isDefault) {
    res.status(400);
    throw new Error("Cannot delete a default template");
  }
  
  await template.deleteOne();
  res.json({ message: "Template removed" });
});

// @desc    Reset a default WhatsApp template to its original state
// @route   POST /api/whatsapp-templates/:id/reset
// @access  Admin
export const resetTemplate = asyncHandler(async (req, res) => {
  const template = await WhatsAppTemplate.findById(req.params.id);
  
  if (!template) {
    res.status(404);
    throw new Error("Template not found");
  }
  
  if (!template.isDefault) {
    res.status(400);
    throw new Error("Cannot reset a custom template");
  }
  
  const defaultTemp = defaultTemplates.find(t => t.name === template.name);
  if (!defaultTemp) {
    res.status(400);
    throw new Error("Original default template not found");
  }
  
  template.messageBody = defaultTemp.messageBody;
  template.variables = defaultTemp.variables;
  
  const updatedTemplate = await template.save();
  res.json(updatedTemplate);
});

// Seed default templates if they don't exist
export const seedDefaultTemplates = async () => {
  try {
    for (const defTemp of defaultTemplates) {
      const exists = await WhatsAppTemplate.findOne({ name: defTemp.name });
      if (!exists) {
        await WhatsAppTemplate.create(defTemp);
      } else {
        // Sync default templates to ensure any updates to variables or body are applied
        exists.messageBody = defTemp.messageBody;
        exists.variables = defTemp.variables;
        await exists.save();
      }
    }
  } catch (error) {
    console.error("Error seeding default WhatsApp templates:", error.message);
  }
};

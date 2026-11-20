// backend/src/controllers/stockController.ts
import { Request, Response, NextFunction } from 'express';
import {
  getOwnerInventory,
  getOwnerInventoryItem,
  addOwnerInventoryItem,
  searchCatalogue,
} from '../services/stockService';
import { wrapEnvelope } from '../utils/responseEnvelope';

/**
 * Handles GET /owner/inventory
 * Returns the authenticated owner's pharmacy inventory, supporting q, status, freshness, and sort filters.
 */
export async function getOwnerInventoryHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ownerId = req.user!.userId;
    const items = await getOwnerInventory(ownerId, req.query as {
      q?: string;
      status?: string;
      freshness?: string;
      sort?: string;
    });
    res.status(200).json(wrapEnvelope(items));
  } catch (err) {
    next(err);
  }
}

/**
 * Handles GET /owner/inventory/:stockId
 * Returns one inventory item belonging to the authenticated owner's pharmacy.
 * Returns 404 for missing items and does not reveal items belonging to other pharmacies.
 */
export async function getOwnerInventoryItemHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ownerId = req.user!.userId;
    const stockId = Array.isArray(req.params.stockId) ? req.params.stockId[0] : req.params.stockId;
    const item = await getOwnerInventoryItem(ownerId, String(stockId));
    res.status(200).json(wrapEnvelope(item));
  } catch (err) {
    next(err);
  }
}

/**
 * Handles POST /owner/inventory
 * Adds an active catalogue medicine to the verified owner's pharmacy inventory.
 */
export async function addOwnerInventoryItemHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ownerId = req.user!.userId;
    const user = req.user!;
    const saved = await addOwnerInventoryItem(ownerId, user, req.body);
    res.status(201).json(wrapEnvelope(saved));
  } catch (err) {
    next(err);
  }
}

/**
 * Handles GET /medicines and GET /api/medicines
 * Returns active curated medicines for the inventory picker modal.
 * Supports q (search query), form (dosage form filter), and limit.
 */
export async function getMedicinesHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const form = typeof req.query.form === 'string' ? req.query.form : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const medicines = await searchCatalogue(q, form, limit);
    res.status(200).json(wrapEnvelope(medicines));
  } catch (err) {
    next(err);
  }
}

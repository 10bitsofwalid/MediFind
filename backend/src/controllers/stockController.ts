// backend/src/controllers/stockController.ts
import { Request, Response, NextFunction } from 'express';
import {
  getOwnerInventory,
  getOwnerInventoryItem,
  addOwnerInventoryItem,
  updateOwnerInventoryItem,
  reconfirmOwnerInventoryItem,
  getOwnerStockHistory,
  searchCatalogue,
  getOwnerSummary,
} from '../services/stockService';
import { wrapEnvelope } from '../utils/responseEnvelope';

/**
 * Handles GET /owner/inventory
 * Returns the authenticated owner's pharmacy inventory, supporting q, status, freshness, attention, and sort filters.
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
      attention?: string;
    });
    res.status(200).json(wrapEnvelope(items));
  } catch (err) {
    next(err);
  }
}

/**
 * Handles GET /owner/summary
 * Returns the operational summary and attention items derived purely from the authenticated
 * owner's persisted inventory.
 */
export async function getOwnerSummaryHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ownerId = req.user!.userId;
    const summary = await getOwnerSummary(ownerId);
    res.status(200).json(wrapEnvelope(summary));
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
 * Handles PATCH /owner/inventory/:stockId
 * Updates an owner's stock record (status, quantity, price, notes).
 * Atomically records append-only StockHistory entry.
 */
export async function updateOwnerInventoryItemHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ownerId = req.user!.userId;
    const user = req.user!;
    const stockId = Array.isArray(req.params.stockId) ? req.params.stockId[0] : req.params.stockId;
    const updated = await updateOwnerInventoryItem(ownerId, user, String(stockId), req.body);
    res.status(200).json(wrapEnvelope(updated));
  } catch (err) {
    next(err);
  }
}

/**
 * Handles POST /owner/inventory/:stockId/reconfirm
 * Records an owner's physical stock check and clears stale/unverified states.
 * Atomically records append-only StockHistory entry.
 */
export async function reconfirmOwnerInventoryItemHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ownerId = req.user!.userId;
    const user = req.user!;
    const stockId = Array.isArray(req.params.stockId) ? req.params.stockId[0] : req.params.stockId;
    const updated = await reconfirmOwnerInventoryItem(ownerId, user, String(stockId), req.body);
    res.status(200).json(wrapEnvelope(updated));
  } catch (err) {
    next(err);
  }
}

/**
 * Handles GET /owner/inventory/:stockId/history
 * Returns read-only, cursor-paginated stock update audit history for the authenticated owner's pharmacy.
 */
export async function getOwnerStockHistoryHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ownerId = req.user!.userId;
    const stockId = Array.isArray(req.params.stockId) ? req.params.stockId[0] : req.params.stockId;
    const historyResponse = await getOwnerStockHistory(ownerId, String(stockId), req.query);
    res.status(200).json(historyResponse);
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

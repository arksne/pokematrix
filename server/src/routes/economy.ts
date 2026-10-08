/**
 * Economy routes:
 *   POST /economy/buy     — покупка предмета
 *   POST /economy/sell    — продажа предмета
 *   POST /economy/craft   — крафт предмета
 *   POST /economy/reward  — ежедневная награда
 *
 * save_data.inventory — { itemId: quantity, ... }
 * Инвентарь хранится в JSON-колонке users.save_data.
 */
import { parseSaveStrict, stampSave } from '../db/save-json.js';
import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { users, serverFeatures } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';

/** Включена ли серверная фича (админка → toggle_feature). */
async function isFeatureOn(db: any, name: string): Promise<boolean> {
  try {
    const row = (await db.select().from(serverFeatures).where(eq(serverFeatures.feature, name)).limit(1))[0];
    return !!row?.enabled;
  } catch { return false; }
}

const router = Router();

// ── Данные предметов ─────────────────────────────────────────
// Полная копия id→price из src/data/items.ts (сгенерировано под M-23:
// магазины продают ВЕСЬ sellable-ассортимент, сервер обязан знать цены).
// ЦЕНЫ НЕ МЕНЯТЬ здесь — только копировать из items.ts (проверяет
// economy-parity.test.ts: сервер→клиент обязаны совпадать).
interface ItemDef {
  id: string;
  price: number;
  category?: string;
}

const ITEMS: ItemDef[] = [
  { id: 'abilityCapsule', price: 10000 },
  { id: 'abilityPatch', price: 20 },
  { id: 'abilityShield', price: 20000 },
  { id: 'abraCandy', price: 20 },
  { id: 'absorbBulb', price: 4000 },
  { id: 'adamantMint', price: 20 },
  { id: 'adrenalineOrb', price: 4000 },
  { id: 'aerodactylCandy', price: 20 },
  { id: 'aguavBerry', price: 80 },
  { id: 'airBalloon', price: 4000 },
  { id: 'amazeMulch', price: 200 },
  { id: 'amuletCoin', price: 10000 },
  { id: 'antiSputin', price: 0 },
  { id: 'antidote', price: 200 },
  { id: 'apicotBerry', price: 80 },
  { id: 'articunoCandy', price: 20 },
  { id: 'aspearBerry', price: 80 },
  { id: 'assaultVest', price: 1000 },
  { id: 'awakening', price: 200 },
  { id: 'babiriBerry', price: 80 },
  { id: 'bachsFoodTin', price: 950 },
  { id: 'balmMushroom', price: 15000 },
  { id: 'beachGlass', price: 800 },
  { id: 'bellsproutCandy', price: 20 },
  { id: 'berryJuice', price: 200 },
  { id: 'berrySweet', price: 500 },
  { id: 'bigBambooShoot', price: 1500 },
  { id: 'bigMalasada', price: 350 },
  { id: 'bigMushroom', price: 5000 },
  { id: 'bigNugget', price: 40000 },
  { id: 'bigPearl', price: 8000 },
  { id: 'bigRoot', price: 4000 },
  { id: 'bindingBand', price: 4000 },
  { id: 'blackAugurite', price: 0 },
  { id: 'blackBelt', price: 1000 },
  { id: 'blackFlute', price: 20 },
  { id: 'blackGlasses', price: 1000 },
  { id: 'blackSludge', price: 4000 },
  { id: 'blueShard', price: 200 },
  { id: 'blunderPolicy', price: 4000 },
  { id: 'bobsFoodTin', price: 950 },
  { id: 'boiledEgg', price: 2200 },
  { id: 'boldMint', price: 20 },
  { id: 'boostMulch', price: 200 },
  { id: 'bottleCap', price: 5000 },
  { id: 'braveMint', price: 20 },
  { id: 'bread', price: 150 },
  { id: 'brightPowder', price: 4000 },
  { id: 'brittleBones', price: 950 },
  { id: 'bugGem', price: 200 },
  { id: 'bulbasaurCandy', price: 20 },
  { id: 'burnHeal', price: 200 },
  { id: 'calcium', price: 9800 },
  { id: 'calmMint', price: 20 },
  { id: 'carbos', price: 9800 },
  { id: 'carefulMint', price: 20 },
  { id: 'casteliacone', price: 350 },
  { id: 'caterpieCandy', price: 20 },
  { id: 'cellBattery', price: 4000 },
  { id: 'chalkyStone', price: 60 },
  { id: 'chanseyCandy', price: 20 },
  { id: 'charcoal', price: 1000 },
  { id: 'charmanderCandy', price: 20 },
  { id: 'chartiBerry', price: 80 },
  { id: 'cheriBerry', price: 80 },
  { id: 'chestoBerry', price: 100 },
  { id: 'chilanBerry', price: 80 },
  { id: 'chippedPot', price: 38000 },
  { id: 'choiceBand', price: 4000 },
  { id: 'choiceScarf', price: 4000 },
  { id: 'choiceSpecs', price: 4000 },
  { id: 'chopleBerry', price: 80 },
  { id: 'cleanseTag', price: 5000 },
  { id: 'clearAmulet', price: 30000 },
  { id: 'clefairyCandy', price: 20 },
  { id: 'cleverMochi', price: 125 },
  { id: 'cleverWing', price: 300 },
  { id: 'cloverSweet', price: 500 },
  { id: 'cobaBerry', price: 80 },
  { id: 'coconutMilk', price: 950 },
  { id: 'colburBerry', price: 80 },
  { id: 'cometShard', price: 25000 },
  { id: 'commonCandy', price: 10000 },
  { id: 'courageCandy', price: 20 },
  { id: 'courageCandyL', price: 20 },
  { id: 'courageCandyXl', price: 20 },
  { id: 'covertCloak', price: 20000 },
  { id: 'crackedPot', price: 1600 },
  { id: 'craftersKit', price: 3000 },
  { id: 'credit', price: 0 },
  { id: 'cuboneCandy', price: 20 },
  { id: 'custapBerry', price: 80 },
  { id: 'dampMulch', price: 200 },
  { id: 'dampRock', price: 4000 },
  { id: 'darkGem', price: 200 },
  { id: 'dawnStone', price: 2100 },
  { id: 'deepSeaScale', price: 2000 },
  { id: 'deepSeaTooth', price: 2000 },
  { id: 'destinyKnot', price: 4000 },
  { id: 'diglettCandy', price: 20 },
  { id: 'direHit', price: 1000 },
  { id: 'discountCoupon', price: 20 },
  { id: 'dittoCandy', price: 20 },
  { id: 'doduoCandy', price: 20 },
  { id: 'dracoPlate', price: 1000 },
  { id: 'dragonFang', price: 1000 },
  { id: 'dragonGem', price: 200 },
  { id: 'dragonScale', price: 2000 },
  { id: 'dratiniCandy', price: 20 },
  { id: 'dreadPlate', price: 1000 },
  { id: 'drowzeeCandy', price: 20 },
  { id: 'dubiousDisc', price: 2000 },
  { id: 'duskStone', price: 2100 },
  { id: 'dynamaxCrystalAnd15', price: 20 },
  { id: 'dynamaxCrystalAnd337', price: 20 },
  { id: 'dynamaxCrystalAnd390', price: 20 },
  { id: 'dynamaxCrystalAnd458', price: 20 },
  { id: 'dynamaxCrystalAnd603', price: 20 },
  { id: 'dynamaxCrystalAql7235', price: 20 },
  { id: 'dynamaxCrystalAql7525', price: 20 },
  { id: 'dynamaxCrystalAql7557', price: 20 },
  { id: 'dynamaxCrystalAql7595', price: 20 },
  { id: 'dynamaxCrystalAql7602', price: 20 },
  { id: 'dynamaxCrystalAqr7950', price: 20 },
  { id: 'dynamaxCrystalAqr8232', price: 20 },
  { id: 'dynamaxCrystalAqr8264', price: 20 },
  { id: 'dynamaxCrystalAqr8414', price: 20 },
  { id: 'dynamaxCrystalAqr8499', price: 20 },
  { id: 'dynamaxCrystalAqr8518', price: 20 },
  { id: 'dynamaxCrystalAqr8610', price: 20 },
  { id: 'dynamaxCrystalAqr8709', price: 20 },
  { id: 'dynamaxCrystalAra6585', price: 20 },
  { id: 'dynamaxCrystalAri546', price: 20 },
  { id: 'dynamaxCrystalAri553', price: 20 },
  { id: 'dynamaxCrystalAri617', price: 20 },
  { id: 'dynamaxCrystalAri951', price: 20 },
  { id: 'dynamaxCrystalAur1577', price: 20 },
  { id: 'dynamaxCrystalAur1605', price: 20 },
  { id: 'dynamaxCrystalAur1612', price: 20 },
  { id: 'dynamaxCrystalAur1641', price: 20 },
  { id: 'dynamaxCrystalAur1708', price: 20 },
  { id: 'dynamaxCrystalAur2088', price: 20 },
  { id: 'dynamaxCrystalAur2095', price: 20 },
  { id: 'dynamaxCrystalBoo5235', price: 20 },
  { id: 'dynamaxCrystalBoo5340', price: 20 },
  { id: 'dynamaxCrystalBoo5351', price: 20 },
  { id: 'dynamaxCrystalBoo5435', price: 20 },
  { id: 'dynamaxCrystalBoo5506', price: 20 },
  { id: 'dynamaxCrystalBoo5602', price: 20 },
  { id: 'dynamaxCrystalBoo5733', price: 20 },
  { id: 'dynamaxCrystalCap7754', price: 20 },
  { id: 'dynamaxCrystalCap7773', price: 20 },
  { id: 'dynamaxCrystalCap7776', price: 20 },
  { id: 'dynamaxCrystalCap8278', price: 20 },
  { id: 'dynamaxCrystalCap8322', price: 20 },
  { id: 'dynamaxCrystalCar2326', price: 20 },
  { id: 'dynamaxCrystalCar3307', price: 20 },
  { id: 'dynamaxCrystalCar3685', price: 20 },
  { id: 'dynamaxCrystalCar3699', price: 20 },
  { id: 'dynamaxCrystalCas153', price: 20 },
  { id: 'dynamaxCrystalCas168', price: 20 },
  { id: 'dynamaxCrystalCas21', price: 20 },
  { id: 'dynamaxCrystalCas219', price: 20 },
  { id: 'dynamaxCrystalCas265', price: 20 },
  { id: 'dynamaxCrystalCas403', price: 20 },
  { id: 'dynamaxCrystalCas542', price: 20 },
  { id: 'dynamaxCrystalCen5267', price: 20 },
  { id: 'dynamaxCrystalCen5288', price: 20 },
  { id: 'dynamaxCrystalCen5459', price: 20 },
  { id: 'dynamaxCrystalCen5460', price: 20 },
  { id: 'dynamaxCrystalCen551', price: 20 },
  { id: 'dynamaxCrystalCep8162', price: 20 },
  { id: 'dynamaxCrystalCep8238', price: 20 },
  { id: 'dynamaxCrystalCep8417', price: 20 },
  { id: 'dynamaxCrystalCep8974', price: 20 },
  { id: 'dynamaxCrystalCet188', price: 20 },
  { id: 'dynamaxCrystalCet539', price: 20 },
  { id: 'dynamaxCrystalCet681', price: 20 },
  { id: 'dynamaxCrystalCet804', price: 20 },
  { id: 'dynamaxCrystalCet911', price: 20 },
  { id: 'dynamaxCrystalCma2282', price: 20 },
  { id: 'dynamaxCrystalCma2294', price: 20 },
  { id: 'dynamaxCrystalCma2491', price: 20 },
  { id: 'dynamaxCrystalCma2618', price: 20 },
  { id: 'dynamaxCrystalCma2646', price: 20 },
  { id: 'dynamaxCrystalCma2657', price: 20 },
  { id: 'dynamaxCrystalCma2693', price: 20 },
  { id: 'dynamaxCrystalCma2827', price: 20 },
  { id: 'dynamaxCrystalCmi2845', price: 20 },
  { id: 'dynamaxCrystalCmi2943', price: 20 },
  { id: 'dynamaxCrystalCnc3208', price: 20 },
  { id: 'dynamaxCrystalCnc3249', price: 20 },
  { id: 'dynamaxCrystalCnc3268', price: 20 },
  { id: 'dynamaxCrystalCnc3429', price: 20 },
  { id: 'dynamaxCrystalCnc3449', price: 20 },
  { id: 'dynamaxCrystalCnc3461', price: 20 },
  { id: 'dynamaxCrystalCnc3572', price: 20 },
  { id: 'dynamaxCrystalCnc3627', price: 20 },
  { id: 'dynamaxCrystalCol1956', price: 20 },
  { id: 'dynamaxCrystalCol2040', price: 20 },
  { id: 'dynamaxCrystalCol2177', price: 20 },
  { id: 'dynamaxCrystalCom4968', price: 20 },
  { id: 'dynamaxCrystalCrt4287', price: 20 },
  { id: 'dynamaxCrystalCru4656', price: 20 },
  { id: 'dynamaxCrystalCru4700', price: 20 },
  { id: 'dynamaxCrystalCru4730', price: 20 },
  { id: 'dynamaxCrystalCru4763', price: 20 },
  { id: 'dynamaxCrystalCru4853', price: 20 },
  { id: 'dynamaxCrystalCrv4623', price: 20 },
  { id: 'dynamaxCrystalCrv4662', price: 20 },
  { id: 'dynamaxCrystalCrv4757', price: 20 },
  { id: 'dynamaxCrystalCrv4786', price: 20 },
  { id: 'dynamaxCrystalCvn4785', price: 20 },
  { id: 'dynamaxCrystalCvn4846', price: 20 },
  { id: 'dynamaxCrystalCvn4915', price: 20 },
  { id: 'dynamaxCrystalCyg7417', price: 20 },
  { id: 'dynamaxCrystalCyg7528', price: 20 },
  { id: 'dynamaxCrystalCyg7796', price: 20 },
  { id: 'dynamaxCrystalCyg7924', price: 20 },
  { id: 'dynamaxCrystalCyg7949', price: 20 },
  { id: 'dynamaxCrystalCyg8301', price: 20 },
  { id: 'dynamaxCrystalDel7852', price: 20 },
  { id: 'dynamaxCrystalDel7882', price: 20 },
  { id: 'dynamaxCrystalDel7906', price: 20 },
  { id: 'dynamaxCrystalDra4434', price: 20 },
  { id: 'dynamaxCrystalDra5291', price: 20 },
  { id: 'dynamaxCrystalDra5744', price: 20 },
  { id: 'dynamaxCrystalDra6132', price: 20 },
  { id: 'dynamaxCrystalDra6370', price: 20 },
  { id: 'dynamaxCrystalDra6396', price: 20 },
  { id: 'dynamaxCrystalDra6536', price: 20 },
  { id: 'dynamaxCrystalDra6636', price: 20 },
  { id: 'dynamaxCrystalDra6688', price: 20 },
  { id: 'dynamaxCrystalDra6705', price: 20 },
  { id: 'dynamaxCrystalDra7310', price: 20 },
  { id: 'dynamaxCrystalDra7462', price: 20 },
  { id: 'dynamaxCrystalEqu8131', price: 20 },
  { id: 'dynamaxCrystalEri1084', price: 20 },
  { id: 'dynamaxCrystalEri1231', price: 20 },
  { id: 'dynamaxCrystalEri1298', price: 20 },
  { id: 'dynamaxCrystalEri1325', price: 20 },
  { id: 'dynamaxCrystalEri1393', price: 20 },
  { id: 'dynamaxCrystalEri1464', price: 20 },
  { id: 'dynamaxCrystalEri1666', price: 20 },
  { id: 'dynamaxCrystalEri472', price: 20 },
  { id: 'dynamaxCrystalEri850', price: 20 },
  { id: 'dynamaxCrystalEri874', price: 20 },
  { id: 'dynamaxCrystalEri897', price: 20 },
  { id: 'dynamaxCrystalEri984', price: 20 },
  { id: 'dynamaxCrystalGem2216', price: 20 },
  { id: 'dynamaxCrystalGem2286', price: 20 },
  { id: 'dynamaxCrystalGem2421', price: 20 },
  { id: 'dynamaxCrystalGem2473', price: 20 },
  { id: 'dynamaxCrystalGem2484', price: 20 },
  { id: 'dynamaxCrystalGem2650', price: 20 },
  { id: 'dynamaxCrystalGem2777', price: 20 },
  { id: 'dynamaxCrystalGem2891', price: 20 },
  { id: 'dynamaxCrystalGem2930', price: 20 },
  { id: 'dynamaxCrystalGem2990', price: 20 },
  { id: 'dynamaxCrystalGru8353', price: 20 },
  { id: 'dynamaxCrystalGru8425', price: 20 },
  { id: 'dynamaxCrystalGru8636', price: 20 },
  { id: 'dynamaxCrystalHer6008', price: 20 },
  { id: 'dynamaxCrystalHer6117', price: 20 },
  { id: 'dynamaxCrystalHer6148', price: 20 },
  { id: 'dynamaxCrystalHer6406', price: 20 },
  { id: 'dynamaxCrystalHer6410', price: 20 },
  { id: 'dynamaxCrystalHer6526', price: 20 },
  { id: 'dynamaxCrystalHya3418', price: 20 },
  { id: 'dynamaxCrystalHya3482', price: 20 },
  { id: 'dynamaxCrystalHya3748', price: 20 },
  { id: 'dynamaxCrystalHya3845', price: 20 },
  { id: 'dynamaxCrystalHya3903', price: 20 },
  { id: 'dynamaxCrystalLeo3773', price: 20 },
  { id: 'dynamaxCrystalLeo3852', price: 20 },
  { id: 'dynamaxCrystalLeo3905', price: 20 },
  { id: 'dynamaxCrystalLeo3982', price: 20 },
  { id: 'dynamaxCrystalLeo4031', price: 20 },
  { id: 'dynamaxCrystalLeo4057', price: 20 },
  { id: 'dynamaxCrystalLeo4357', price: 20 },
  { id: 'dynamaxCrystalLeo4359', price: 20 },
  { id: 'dynamaxCrystalLeo4534', price: 20 },
  { id: 'dynamaxCrystalLep1829', price: 20 },
  { id: 'dynamaxCrystalLep1865', price: 20 },
  { id: 'dynamaxCrystalLib5531', price: 20 },
  { id: 'dynamaxCrystalLib5603', price: 20 },
  { id: 'dynamaxCrystalLib5685', price: 20 },
  { id: 'dynamaxCrystalLib5787', price: 20 },
  { id: 'dynamaxCrystalLyr7001', price: 20 },
  { id: 'dynamaxCrystalLyr7106', price: 20 },
  { id: 'dynamaxCrystalLyr7178', price: 20 },
  { id: 'dynamaxCrystalLyr7298', price: 20 },
  { id: 'dynamaxCrystalOct7228', price: 20 },
  { id: 'dynamaxCrystalOph6056', price: 20 },
  { id: 'dynamaxCrystalOph6075', price: 20 },
  { id: 'dynamaxCrystalOph6149', price: 20 },
  { id: 'dynamaxCrystalOph6378', price: 20 },
  { id: 'dynamaxCrystalOph6556', price: 20 },
  { id: 'dynamaxCrystalOph6603', price: 20 },
  { id: 'dynamaxCrystalOri1543', price: 20 },
  { id: 'dynamaxCrystalOri1713', price: 20 },
  { id: 'dynamaxCrystalOri1790', price: 20 },
  { id: 'dynamaxCrystalOri1852', price: 20 },
  { id: 'dynamaxCrystalOri1879', price: 20 },
  { id: 'dynamaxCrystalOri1899', price: 20 },
  { id: 'dynamaxCrystalOri1903', price: 20 },
  { id: 'dynamaxCrystalOri1948', price: 20 },
  { id: 'dynamaxCrystalOri2004', price: 20 },
  { id: 'dynamaxCrystalOri2061', price: 20 },
  { id: 'dynamaxCrystalPav7790', price: 20 },
  { id: 'dynamaxCrystalPeg39', price: 20 },
  { id: 'dynamaxCrystalPeg8308', price: 20 },
  { id: 'dynamaxCrystalPeg8450', price: 20 },
  { id: 'dynamaxCrystalPeg8634', price: 20 },
  { id: 'dynamaxCrystalPeg8650', price: 20 },
  { id: 'dynamaxCrystalPeg8684', price: 20 },
  { id: 'dynamaxCrystalPeg8775', price: 20 },
  { id: 'dynamaxCrystalPeg8781', price: 20 },
  { id: 'dynamaxCrystalPeg8880', price: 20 },
  { id: 'dynamaxCrystalPeg8905', price: 20 },
  { id: 'dynamaxCrystalPer1017', price: 20 },
  { id: 'dynamaxCrystalPer1131', price: 20 },
  { id: 'dynamaxCrystalPer1228', price: 20 },
  { id: 'dynamaxCrystalPer834', price: 20 },
  { id: 'dynamaxCrystalPer936', price: 20 },
  { id: 'dynamaxCrystalPer941', price: 20 },
  { id: 'dynamaxCrystalPhe338', price: 20 },
  { id: 'dynamaxCrystalPhe99', price: 20 },
  { id: 'dynamaxCrystalPsa8728', price: 20 },
  { id: 'dynamaxCrystalPsc361', price: 20 },
  { id: 'dynamaxCrystalPsc437', price: 20 },
  { id: 'dynamaxCrystalPsc510', price: 20 },
  { id: 'dynamaxCrystalPsc596', price: 20 },
  { id: 'dynamaxCrystalPsc8773', price: 20 },
  { id: 'dynamaxCrystalPup3045', price: 20 },
  { id: 'dynamaxCrystalPup3165', price: 20 },
  { id: 'dynamaxCrystalPup3185', price: 20 },
  { id: 'dynamaxCrystalSco5928', price: 20 },
  { id: 'dynamaxCrystalSco5944', price: 20 },
  { id: 'dynamaxCrystalSco5953', price: 20 },
  { id: 'dynamaxCrystalSco5984', price: 20 },
  { id: 'dynamaxCrystalSco6027', price: 20 },
  { id: 'dynamaxCrystalSco6084', price: 20 },
  { id: 'dynamaxCrystalSco6134', price: 20 },
  { id: 'dynamaxCrystalSco6165', price: 20 },
  { id: 'dynamaxCrystalSco6241', price: 20 },
  { id: 'dynamaxCrystalSco6247', price: 20 },
  { id: 'dynamaxCrystalSco6252', price: 20 },
  { id: 'dynamaxCrystalSco6508', price: 20 },
  { id: 'dynamaxCrystalSco6527', price: 20 },
  { id: 'dynamaxCrystalSco6553', price: 20 },
  { id: 'dynamaxCrystalSco6630', price: 20 },
  { id: 'dynamaxCrystalSer5854', price: 20 },
  { id: 'dynamaxCrystalSer5879', price: 20 },
  { id: 'dynamaxCrystalSer7141', price: 20 },
  { id: 'dynamaxCrystalSge7479', price: 20 },
  { id: 'dynamaxCrystalSgr6746', price: 20 },
  { id: 'dynamaxCrystalSgr6812', price: 20 },
  { id: 'dynamaxCrystalSgr6859', price: 20 },
  { id: 'dynamaxCrystalSgr6879', price: 20 },
  { id: 'dynamaxCrystalSgr6913', price: 20 },
  { id: 'dynamaxCrystalSgr7116', price: 20 },
  { id: 'dynamaxCrystalSgr7121', price: 20 },
  { id: 'dynamaxCrystalSgr7194', price: 20 },
  { id: 'dynamaxCrystalSgr7264', price: 20 },
  { id: 'dynamaxCrystalSgr7337', price: 20 },
  { id: 'dynamaxCrystalSgr7343', price: 20 },
  { id: 'dynamaxCrystalSgr7348', price: 20 },
  { id: 'dynamaxCrystalSgr7597', price: 20 },
  { id: 'dynamaxCrystalTau1165', price: 20 },
  { id: 'dynamaxCrystalTau1346', price: 20 },
  { id: 'dynamaxCrystalTau1373', price: 20 },
  { id: 'dynamaxCrystalTau1409', price: 20 },
  { id: 'dynamaxCrystalTau1412', price: 20 },
  { id: 'dynamaxCrystalTau1457', price: 20 },
  { id: 'dynamaxCrystalTau1791', price: 20 },
  { id: 'dynamaxCrystalTau1910', price: 20 },
  { id: 'dynamaxCrystalTra6217', price: 20 },
  { id: 'dynamaxCrystalTri544', price: 20 },
  { id: 'dynamaxCrystalUma3323', price: 20 },
  { id: 'dynamaxCrystalUma3569', price: 20 },
  { id: 'dynamaxCrystalUma3594', price: 20 },
  { id: 'dynamaxCrystalUma4033', price: 20 },
  { id: 'dynamaxCrystalUma4069', price: 20 },
  { id: 'dynamaxCrystalUma4295', price: 20 },
  { id: 'dynamaxCrystalUma4301', price: 20 },
  { id: 'dynamaxCrystalUma4375', price: 20 },
  { id: 'dynamaxCrystalUma4377', price: 20 },
  { id: 'dynamaxCrystalUma4518', price: 20 },
  { id: 'dynamaxCrystalUma4554', price: 20 },
  { id: 'dynamaxCrystalUma4660', price: 20 },
  { id: 'dynamaxCrystalUma4905', price: 20 },
  { id: 'dynamaxCrystalUma5054', price: 20 },
  { id: 'dynamaxCrystalUma5191', price: 20 },
  { id: 'dynamaxCrystalUmi424', price: 20 },
  { id: 'dynamaxCrystalUmi5563', price: 20 },
  { id: 'dynamaxCrystalUmi5735', price: 20 },
  { id: 'dynamaxCrystalUmi6789', price: 20 },
  { id: 'dynamaxCrystalVel3485', price: 20 },
  { id: 'dynamaxCrystalVel3634', price: 20 },
  { id: 'dynamaxCrystalVel3734', price: 20 },
  { id: 'dynamaxCrystalVir4540', price: 20 },
  { id: 'dynamaxCrystalVir4689', price: 20 },
  { id: 'dynamaxCrystalVir4825', price: 20 },
  { id: 'dynamaxCrystalVir4910', price: 20 },
  { id: 'dynamaxCrystalVir4932', price: 20 },
  { id: 'dynamaxCrystalVir5056', price: 20 },
  { id: 'dynamaxCrystalVir5107', price: 20 },
  { id: 'dynamaxCrystalVir5315', price: 20 },
  { id: 'dynamaxCrystalVir5338', price: 20 },
  { id: 'dynamaxCrystalVir5359', price: 20 },
  { id: 'dynamaxCrystalVir5409', price: 20 },
  { id: 'dynamaxCrystalVul7405', price: 20 },
  { id: 'earthPlate', price: 1000 },
  { id: 'eeveeCandy', price: 20 },
  { id: 'ejectButton', price: 4000 },
  { id: 'ejectPack', price: 4000 },
  { id: 'ekansCandy', price: 20 },
  { id: 'electabuzzCandy', price: 20 },
  { id: 'electirizer', price: 2000 },
  { id: 'electricGem', price: 200 },
  { id: 'electricSeed', price: 4000 },
  { id: 'elixir', price: 1200 },
  { id: 'energyPowder', price: 500 },
  { id: 'energyRoot', price: 1200 },
  { id: 'enigmaBerry', price: 80 },
  { id: 'escapeRope', price: 300 },
  { id: 'ether', price: 600 },
  { id: 'evBrace', price: 25000000 },
  { id: 'everstone', price: 3000 },
  { id: 'eviolite', price: 4000 },
  { id: 'evolutionStone', price: 0 },
  { id: 'exeggcuteCandy', price: 20 },
  { id: 'expCandyL', price: 3000 },
  { id: 'expCandyM', price: 1000 },
  { id: 'expCandyS', price: 240 },
  { id: 'expCandyXl', price: 10000 },
  { id: 'expCandyXs', price: 20 },
  { id: 'expertBelt', price: 4000 },
  { id: 'fairyFeather', price: 750 },
  { id: 'fairyGem', price: 200 },
  { id: 'fancyApple', price: 2200 },
  { id: 'farfetchdCandy', price: 20 },
  { id: 'ferryTicket', price: 300000 },
  { id: 'fightingGem', price: 200 },
  { id: 'figyBerry', price: 80 },
  { id: 'fireGem', price: 200 },
  { id: 'fireStone', price: 2100 },
  { id: 'fistPlate', price: 1000 },
  { id: 'flameOrb', price: 4000 },
  { id: 'flamePlate', price: 1000 },
  { id: 'floatStone', price: 4000 },
  { id: 'flowerSweet', price: 500 },
  { id: 'fluffyTail', price: 100 },
  { id: 'flyingGem', price: 200 },
  { id: 'focusBand', price: 4000 },
  { id: 'focusSash', price: 4000 },
  { id: 'freshCream', price: 950 },
  { id: 'freshStartMochi', price: 75 },
  { id: 'freshWater', price: 200 },
  { id: 'friedFood', price: 150 },
  { id: 'fruitBunch', price: 2200 },
  { id: 'fullHeal', price: 400 },
  { id: 'fullIncense', price: 5000 },
  { id: 'fullRestore', price: 3000 },
  { id: 'ganlonBerry', price: 80 },
  { id: 'gastlyCandy', price: 20 },
  { id: 'geniusMochi', price: 125 },
  { id: 'geniusWing', price: 300 },
  { id: 'gentleMint', price: 20 },
  { id: 'geodudeCandy', price: 20 },
  { id: 'ghostGem', price: 200 },
  { id: 'gigantamix', price: 15000 },
  { id: 'goldBottleCap', price: 10000 },
  { id: 'goldLeaf', price: 1000 },
  { id: 'goldeenCandy', price: 20 },
  { id: 'goldenNanabBerry', price: 5000 },
  { id: 'goldenPinapBerry', price: 5000 },
  { id: 'goldenRazzBerry', price: 5000 },
  { id: 'goodRod', price: 2000 },
  { id: 'gooeyMulch', price: 200 },
  { id: 'grassGem', price: 200 },
  { id: 'grassySeed', price: 4000 },
  { id: 'greenShard', price: 200 },
  { id: 'grepaBerry', price: 80 },
  { id: 'grimerCandy', price: 20 },
  { id: 'gripClaw', price: 4000 },
  { id: 'groundGem', price: 200 },
  { id: 'growlitheCandy', price: 20 },
  { id: 'growthMulch', price: 200 },
  { id: 'guardSpec', price: 1500 },
  { id: 'habanBerry', price: 80 },
  { id: 'hardStone', price: 1000 },
  { id: 'hastyMint', price: 20 },
  { id: 'healPowder', price: 300 },
  { id: 'healingHerb', price: 0 },
  { id: 'healthCandy', price: 20 },
  { id: 'healthCandyL', price: 20 },
  { id: 'healthCandyXl', price: 20 },
  { id: 'healthMochi', price: 125 },
  { id: 'healthWing', price: 300 },
  { id: 'heartScale', price: 1000 },
  { id: 'heatRock', price: 4000 },
  { id: 'heavyDutyBoots', price: 4000 },
  { id: 'hitmonchanCandy', price: 20 },
  { id: 'hitmonleeCandy', price: 20 },
  { id: 'hondewBerry', price: 80 },
  { id: 'honey', price: 500 },
  { id: 'horseaCandy', price: 20 },
  { id: 'hpUp', price: 9800 },
  { id: 'hyperPotion', price: 1500 },
  { id: 'iapapaBerry', price: 80 },
  { id: 'iceGem', price: 200 },
  { id: 'iceHeal', price: 200 },
  { id: 'iceStone', price: 2100 },
  { id: 'iciclePlate', price: 1000 },
  { id: 'icyRock', price: 4000 },
  { id: 'impishMint', price: 20 },
  { id: 'insectPlate', price: 1000 },
  { id: 'instantNoodles', price: 150 },
  { id: 'iron', price: 9800 },
  { id: 'ironBall', price: 4000 },
  { id: 'ironPlate', price: 1000 },
  { id: 'jabocaBerry', price: 80 },
  { id: 'jigglypuffCandy', price: 20 },
  { id: 'jollyMint', price: 20 },
  { id: 'jynxCandy', price: 20 },
  { id: 'kabutoCandy', price: 20 },
  { id: 'kangaskhanCandy', price: 20 },
  { id: 'kasibBerry', price: 80 },
  { id: 'kebiaBerry', price: 80 },
  { id: 'keeBerry', price: 80 },
  { id: 'kelpsyBerry', price: 80 },
  { id: 'kingsRock', price: 5000 },
  { id: 'koffingCandy', price: 20 },
  { id: 'krabbyCandy', price: 20 },
  { id: 'laggingTail', price: 4000 },
  { id: 'lansatBerry', price: 80 },
  { id: 'laprasCandy', price: 20 },
  { id: 'largeLeek', price: 2200 },
  { id: 'lavaCookie', price: 350 },
  { id: 'laxIncense', price: 5000 },
  { id: 'laxMint', price: 20 },
  { id: 'leafStone', price: 2100 },
  { id: 'leftovers', price: 4000 },
  { id: 'lemonade', price: 400 },
  { id: 'leppaBerry', price: 80 },
  { id: 'lickitungCandy', price: 20 },
  { id: 'liechiBerry', price: 80 },
  { id: 'lifeOrb', price: 4000 },
  { id: 'lightBall', price: 1000 },
  { id: 'lightClay', price: 4000 },
  { id: 'linkingCord', price: 8000 },
  { id: 'loadedDice', price: 20000 },
  { id: 'loneEarring', price: 600 },
  { id: 'lonelyMint', price: 20 },
  { id: 'loveSweet', price: 500 },
  { id: 'luckIncense', price: 11000 },
  { id: 'luckyEgg', price: 0 },
  { id: 'luckyPunch', price: 1000 },
  { id: 'lumBerry', price: 300 },
  { id: 'luminousMoss', price: 4000 },
  { id: 'lumioseGalette', price: 350 },
  { id: 'lure', price: 400 },
  { id: 'machoBrace', price: 3000 },
  { id: 'machopCandy', price: 20 },
  { id: 'magikarpCandy', price: 20 },
  { id: 'magmarCandy', price: 20 },
  { id: 'magmarizer', price: 2000 },
  { id: 'magnemiteCandy', price: 20 },
  { id: 'magnet', price: 1000 },
  { id: 'magoBerry', price: 80 },
  { id: 'maliciousArmor', price: 750 },
  { id: 'mankeyCandy', price: 20 },
  { id: 'marangaBerry', price: 80 },
  { id: 'marble', price: 300 },
  { id: 'masterpieceTeacup', price: 9500 },
  { id: 'maxElixir', price: 4500 },
  { id: 'maxEther', price: 2000 },
  { id: 'maxHoney', price: 4000 },
  { id: 'maxLure', price: 900 },
  { id: 'maxMushrooms', price: 6000 },
  { id: 'maxPotion', price: 2500 },
  { id: 'maxRepel', price: 900 },
  { id: 'maxRevive', price: 4000 },
  { id: 'meadowPlate', price: 1000 },
  { id: 'meltanCandy', price: 20 },
  { id: 'mentalHerb', price: 4000 },
  { id: 'meowthCandy', price: 20 },
  { id: 'metalAlloy', price: 0 },
  { id: 'metalCoat', price: 2000 },
  { id: 'metalPowder', price: 1000 },
  { id: 'metronome', price: 4000 },
  { id: 'mewCandy', price: 20 },
  { id: 'mewtwoCandy', price: 20 },
  { id: 'micleBerry', price: 80 },
  { id: 'mightyCandy', price: 20 },
  { id: 'mightyCandyL', price: 20 },
  { id: 'mightyCandyXl', price: 20 },
  { id: 'mildMint', price: 20 },
  { id: 'mindPlate', price: 1000 },
  { id: 'miracleSeed', price: 1000 },
  { id: 'mirrorHerb', price: 30000 },
  { id: 'mistySeed', price: 4000 },
  { id: 'mixedMushrooms', price: 400 },
  { id: 'modestMint', price: 20 },
  { id: 'moltresCandy', price: 20 },
  { id: 'moomooCheese', price: 2200 },
  { id: 'moomooMilk', price: 600 },
  { id: 'moonStone', price: 2100 },
  { id: 'mrMimeCandy', price: 20 },
  { id: 'muscleBand', price: 4000 },
  { id: 'muscleMochi', price: 125 },
  { id: 'muscleWing', price: 300 },
  { id: 'mysticWater', price: 1000 },
  { id: 'naiveMint', price: 20 },
  { id: 'naughtyMint', price: 20 },
  { id: 'neverMeltIce', price: 1000 },
  { id: 'nidoranFCandy', price: 20 },
  { id: 'nidoranMCandy', price: 20 },
  { id: 'normalGem', price: 4000 },
  { id: 'nugget', price: 10000 },
  { id: 'occaBerry', price: 80 },
  { id: 'oddIncense', price: 2000 },
  { id: 'oddishCandy', price: 20 },
  { id: 'oldGateau', price: 350 },
  { id: 'oldRod', price: 500 },
  { id: 'omanyteCandy', price: 20 },
  { id: 'onixCandy', price: 20 },
  { id: 'oranBerry', price: 150 },
  { id: 'ovalStone', price: 2000 },
  { id: 'packOfPotatoes', price: 400 },
  { id: 'packagedCurry', price: 950 },
  { id: 'paralyzeHeal', price: 200 },
  { id: 'parasCandy', price: 20 },
  { id: 'passOrb', price: 200 },
  { id: 'passhoBerry', price: 80 },
  { id: 'pasta', price: 150 },
  { id: 'payapaBerry', price: 80 },
  { id: 'pearl', price: 2000 },
  { id: 'pearlString', price: 20000 },
  { id: 'peatBlock', price: 0 },
  { id: 'pechaBerry', price: 80 },
  { id: 'persimBerry', price: 80 },
  { id: 'petayaBerry', price: 80 },
  { id: 'pewterCrunchies', price: 250 },
  { id: 'pidgeyCandy', price: 20 },
  { id: 'pikachuCandy', price: 20 },
  { id: 'pinkNectar', price: 300 },
  { id: 'pinsirCandy', price: 20 },
  { id: 'pixiePlate', price: 1000 },
  { id: 'poisonBarb', price: 1000 },
  { id: 'poisonGem', price: 200 },
  { id: 'pokeDoll', price: 300 },
  { id: 'pokeToy', price: 100 },
  { id: 'polishedMudBall', price: 1200 },
  { id: 'poliwagCandy', price: 20 },
  { id: 'pomegBerry', price: 80 },
  { id: 'ponytaCandy', price: 20 },
  { id: 'porygonCandy', price: 20 },
  { id: 'potion', price: 300 },
  { id: 'powerAnklet', price: 3000 },
  { id: 'powerBand', price: 3000 },
  { id: 'powerBelt', price: 3000 },
  { id: 'powerBracer', price: 3000 },
  { id: 'powerHerb', price: 4000 },
  { id: 'powerLens', price: 3000 },
  { id: 'powerWeight', price: 3000 },
  { id: 'ppMax', price: 10000 },
  { id: 'ppUp', price: 6400 },
  { id: 'precookedBurger', price: 150 },
  { id: 'prettyWing', price: 1000 },
  { id: 'prismScale', price: 2000 },
  { id: 'protectivePads', price: 4000 },
  { id: 'protector', price: 2000 },
  { id: 'protein', price: 9800 },
  { id: 'psychicGem', price: 200 },
  { id: 'psychicSeed', price: 4000 },
  { id: 'psyduckCandy', price: 20 },
  { id: 'punchingGlove', price: 15000 },
  { id: 'pungentRoot', price: 950 },
  { id: 'pureIncense', price: 6000 },
  { id: 'purpleNectar', price: 300 },
  { id: 'qualotBerry', price: 80 },
  { id: 'quickCandy', price: 20 },
  { id: 'quickCandyL', price: 20 },
  { id: 'quickCandyXl', price: 20 },
  { id: 'quickClaw', price: 4000 },
  { id: 'quickPowder', price: 1000 },
  { id: 'quietMint', price: 20 },
  { id: 'rareBone', price: 5000 },
  { id: 'rareCandy', price: 800000 },
  { id: 'rashMint', price: 20 },
  { id: 'rattataCandy', price: 20 },
  { id: 'rawstBerry', price: 100 },
  { id: 'razorClaw', price: 5000 },
  { id: 'razorFang', price: 5000 },
  { id: 'reaperCloth', price: 2000 },
  { id: 'redCard', price: 4000 },
  { id: 'redNectar', price: 300 },
  { id: 'redShard', price: 200 },
  { id: 'relaxedMint', price: 20 },
  { id: 'relicGold', price: 60000 },
  { id: 'repel', price: 400 },
  { id: 'resistMochi', price: 125 },
  { id: 'resistWing', price: 300 },
  { id: 'revivalHerb', price: 2800 },
  { id: 'revive', price: 2000 },
  { id: 'rhyhornCandy', price: 20 },
  { id: 'ribbonSweet', price: 500 },
  { id: 'richMulch', price: 200 },
  { id: 'rindoBerry', price: 80 },
  { id: 'ringTarget', price: 4000 },
  { id: 'rockGem', price: 200 },
  { id: 'rockIncense', price: 2000 },
  { id: 'rockyHelmet', price: 4000 },
  { id: 'roomService', price: 4000 },
  { id: 'roseIncense', price: 2000 },
  { id: 'roseliBerry', price: 80 },
  { id: 'rowapBerry', price: 80 },
  { id: 'sachet', price: 2000 },
  { id: 'sacredAsh', price: 50000 },
  { id: 'safetyGoggles', price: 4000 },
  { id: 'salacBerry', price: 80 },
  { id: 'saladMix', price: 400 },
  { id: 'sandshrewCandy', price: 20 },
  { id: 'sassyMint', price: 20 },
  { id: 'sausages', price: 400 },
  { id: 'scopeLens', price: 4000 },
  { id: 'scytherCandy', price: 20 },
  { id: 'seaIncense', price: 2000 },
  { id: 'seelCandy', price: 20 },
  { id: 'seriousMint', price: 20 },
  { id: 'shalourSable', price: 350 },
  { id: 'sharpBeak', price: 1000 },
  { id: 'shedShell', price: 4000 },
  { id: 'shellBell', price: 4000 },
  { id: 'shellderCandy', price: 20 },
  { id: 'shinyStone', price: 2100 },
  { id: 'shucaBerry', price: 80 },
  { id: 'silkScarf', price: 1000 },
  { id: 'silverLeaf', price: 1000 },
  { id: 'silverNanabBerry', price: 1000 },
  { id: 'silverPinapBerry', price: 1000 },
  { id: 'silverPowder', price: 1000 },
  { id: 'silverRazzBerry', price: 1000 },
  { id: 'sitrusBerry', price: 200 },
  { id: 'skyPlate', price: 1000 },
  { id: 'slowpokeCandy', price: 20 },
  { id: 'smartCandy', price: 20 },
  { id: 'smartCandyL', price: 20 },
  { id: 'smartCandyXl', price: 20 },
  { id: 'smokeBall', price: 4000 },
  { id: 'smokePokeTail', price: 2200 },
  { id: 'smoothRock', price: 4000 },
  { id: 'snorlaxCandy', price: 20 },
  { id: 'snowball', price: 4000 },
  { id: 'sodaPop', price: 300 },
  { id: 'softSand', price: 1000 },
  { id: 'sootheBell', price: 4000 },
  { id: 'spearowCandy', price: 20 },
  { id: 'spellTag', price: 1000 },
  { id: 'spiceMix', price: 400 },
  { id: 'splashPlate', price: 1000 },
  { id: 'spookyPlate', price: 1000 },
  { id: 'squirtleCandy', price: 20 },
  { id: 'stableMulch', price: 200 },
  { id: 'starPiece', price: 12000 },
  { id: 'starSweet', price: 500 },
  { id: 'stardust', price: 3000 },
  { id: 'starfBerry', price: 80 },
  { id: 'staryuCandy', price: 20 },
  { id: 'steelGem', price: 200 },
  { id: 'stick', price: 1000 },
  { id: 'stickyBarb', price: 4000 },
  { id: 'stonePlate', price: 1000 },
  { id: 'strangeSouvenir', price: 3000 },
  { id: 'strawberrySweet', price: 500 },
  { id: 'stretchySpring', price: 20 },
  { id: 'sunStone', price: 2100 },
  { id: 'superLure', price: 700 },
  { id: 'superPotion', price: 700 },
  { id: 'superRepel', price: 700 },
  { id: 'superRod', price: 10000 },
  { id: 'surpriseMulch', price: 200 },
  { id: 'sweetApple', price: 2200 },
  { id: 'sweetHeart', price: 3000 },
  { id: 'swiftMochi', price: 125 },
  { id: 'swiftWing', price: 300 },
  { id: 'syrupyApple', price: 500 },
  { id: 'tamatoBerry', price: 80 },
  { id: 'tangaBerry', price: 80 },
  { id: 'tangelaCandy', price: 20 },
  { id: 'tartApple', price: 2200 },
  { id: 'taurosCandy', price: 20 },
  { id: 'tentacoolCandy', price: 20 },
  { id: 'terrainExtender', price: 4000 },
  { id: 'thickClub', price: 1000 },
  { id: 'throatSpray', price: 4000 },
  { id: 'thunderStone', price: 2100 },
  { id: 'timidMint', price: 20 },
  { id: 'tinOfBeans', price: 400 },
  { id: 'tinyBambooShoot', price: 375 },
  { id: 'tinyMushroom', price: 500 },
  { id: 'tm', price: 500 },
  { id: 'tm00', price: 10000 },
  { id: 'tm01', price: 40000 },
  { id: 'tm02', price: 1000 },
  { id: 'tm03', price: 50000 },
  { id: 'tm04', price: 50000 },
  { id: 'tm05', price: 50000 },
  { id: 'tm06', price: 1000 },
  { id: 'tm07', price: 1000 },
  { id: 'tm08', price: 50000 },
  { id: 'tm09', price: 50000 },
  { id: 'tm10', price: 1000 },
  { id: 'tm100', price: 5000 },
  { id: 'tm11', price: 1000 },
  { id: 'tm12', price: 50000 },
  { id: 'tm13', price: 10000 },
  { id: 'tm14', price: 1000 },
  { id: 'tm15', price: 1000 },
  { id: 'tm16', price: 1000 },
  { id: 'tm17', price: 10000 },
  { id: 'tm18', price: 10000 },
  { id: 'tm19', price: 10000 },
  { id: 'tm20', price: 100000 },
  { id: 'tm21', price: 1000 },
  { id: 'tm22', price: 1000 },
  { id: 'tm23', price: 10000 },
  { id: 'tm24', price: 1000 },
  { id: 'tm25', price: 10000 },
  { id: 'tm26', price: 1000 },
  { id: 'tm27', price: 1000 },
  { id: 'tm28', price: 100000 },
  { id: 'tm29', price: 1000 },
  { id: 'tm30', price: 1000 },
  { id: 'tm31', price: 1000 },
  { id: 'tm32', price: 10000 },
  { id: 'tm33', price: 10000 },
  { id: 'tm34', price: 10000 },
  { id: 'tm35', price: 10000 },
  { id: 'tm36', price: 1000 },
  { id: 'tm37', price: 1000 },
  { id: 'tm38', price: 1000 },
  { id: 'tm39', price: 1000 },
  { id: 'tm40', price: 1000 },
  { id: 'tm41', price: 10000 },
  { id: 'tm42', price: 1000 },
  { id: 'tm43', price: 1000 },
  { id: 'tm44', price: 100000 },
  { id: 'tm45', price: 1000 },
  { id: 'tm46', price: 30000 },
  { id: 'tm47', price: 1000 },
  { id: 'tm48', price: 1000 },
  { id: 'tm49', price: 1000 },
  { id: 'tm50', price: 10000 },
  { id: 'tm51', price: 1000 },
  { id: 'tm52', price: 100000 },
  { id: 'tm53', price: 1000 },
  { id: 'tm54', price: 1000 },
  { id: 'tm55', price: 10000 },
  { id: 'tm56', price: 1000 },
  { id: 'tm57', price: 1000 },
  { id: 'tm58', price: 1000 },
  { id: 'tm59', price: 100000 },
  { id: 'tm60', price: 30000 },
  { id: 'tm61', price: 30000 },
  { id: 'tm62', price: 30000 },
  { id: 'tm63', price: 50000 },
  { id: 'tm64', price: 1000 },
  { id: 'tm65', price: 1000 },
  { id: 'tm66', price: 30000 },
  { id: 'tm67', price: 30000 },
  { id: 'tm68', price: 30000 },
  { id: 'tm69', price: 1000 },
  { id: 'tm70', price: 50000 },
  { id: 'tm71', price: 50000 },
  { id: 'tm72', price: 50000 },
  { id: 'tm73', price: 1000 },
  { id: 'tm74', price: 1000 },
  { id: 'tm75', price: 1000 },
  { id: 'tm76', price: 10000 },
  { id: 'tm77', price: 1000 },
  { id: 'tm78', price: 1000 },
  { id: 'tm79', price: 1000 },
  { id: 'tm80', price: 1000 },
  { id: 'tm81', price: 1000 },
  { id: 'tm82', price: 1000 },
  { id: 'tm83', price: 100000 },
  { id: 'tm84', price: 1000 },
  { id: 'tm85', price: 1000 },
  { id: 'tm86', price: 1000 },
  { id: 'tm87', price: 1000 },
  { id: 'tm88', price: 20000 },
  { id: 'tm89', price: 20000 },
  { id: 'tm90', price: 20000 },
  { id: 'tm91', price: 20000 },
  { id: 'tm92', price: 100000 },
  { id: 'tm93', price: 1000 },
  { id: 'tm94', price: 10000 },
  { id: 'tm95', price: 1000 },
  { id: 'tm96', price: 1000 },
  { id: 'tm97', price: 1000 },
  { id: 'tm98', price: 1000 },
  { id: 'tm99', price: 1000 },
  { id: 'tmMid', price: 2000000 },
  { id: 'tmTop', price: 20000000 },
  { id: 'tmWeak', price: 200000 },
  { id: 'toughCandy', price: 20 },
  { id: 'toughCandyL', price: 20 },
  { id: 'toughCandyXl', price: 20 },
  { id: 'toxicOrb', price: 4000 },
  { id: 'toxicPlate', price: 1000 },
  { id: 'tr00', price: 4000 },
  { id: 'tr01', price: 6000 },
  { id: 'tr02', price: 10000 },
  { id: 'tr03', price: 16000 },
  { id: 'tr04', price: 10000 },
  { id: 'tr05', price: 10000 },
  { id: 'tr06', price: 16000 },
  { id: 'tr07', price: 6000 },
  { id: 'tr08', price: 10000 },
  { id: 'tr09', price: 16000 },
  { id: 'tr10', price: 16000 },
  { id: 'tr11', price: 10000 },
  { id: 'tr12', price: 4000 },
  { id: 'tr13', price: 2000 },
  { id: 'tr14', price: 2000 },
  { id: 'tr15', price: 16000 },
  { id: 'tr16', price: 6000 },
  { id: 'tr17', price: 4000 },
  { id: 'tr18', price: 6000 },
  { id: 'tr19', price: 4000 },
  { id: 'tr20', price: 6000 },
  { id: 'tr21', price: 4000 },
  { id: 'tr22', price: 10000 },
  { id: 'tr23', price: 4000 },
  { id: 'tr24', price: 16000 },
  { id: 'tr25', price: 6000 },
  { id: 'tr26', price: 2000 },
  { id: 'tr27', price: 4000 },
  { id: 'tr28', price: 16000 },
  { id: 'tr29', price: 4000 },
  { id: 'tr30', price: 4000 },
  { id: 'tr31', price: 10000 },
  { id: 'tr32', price: 6000 },
  { id: 'tr33', price: 6000 },
  { id: 'tr34', price: 6000 },
  { id: 'tr35', price: 6000 },
  { id: 'tr36', price: 10000 },
  { id: 'tr37', price: 4000 },
  { id: 'tr38', price: 4000 },
  { id: 'tr39', price: 16000 },
  { id: 'tr40', price: 2000 },
  { id: 'tr41', price: 6000 },
  { id: 'tr42', price: 10000 },
  { id: 'tr43', price: 16000 },
  { id: 'tr44', price: 4000 },
  { id: 'tr45', price: 10000 },
  { id: 'tr46', price: 4000 },
  { id: 'tr47', price: 6000 },
  { id: 'tr48', price: 4000 },
  { id: 'tr49', price: 4000 },
  { id: 'tr50', price: 10000 },
  { id: 'tr51', price: 4000 },
  { id: 'tr52', price: 6000 },
  { id: 'tr53', price: 16000 },
  { id: 'tr54', price: 4000 },
  { id: 'tr55', price: 16000 },
  { id: 'tr56', price: 6000 },
  { id: 'tr57', price: 6000 },
  { id: 'tr58', price: 6000 },
  { id: 'tr59', price: 6000 },
  { id: 'tr60', price: 6000 },
  { id: 'tr61', price: 10000 },
  { id: 'tr62', price: 6000 },
  { id: 'tr63', price: 6000 },
  { id: 'tr64', price: 16000 },
  { id: 'tr65', price: 10000 },
  { id: 'tr66', price: 16000 },
  { id: 'tr67', price: 10000 },
  { id: 'tr68', price: 4000 },
  { id: 'tr69', price: 6000 },
  { id: 'tr70', price: 10000 },
  { id: 'tr71', price: 16000 },
  { id: 'tr72', price: 16000 },
  { id: 'tr73', price: 16000 },
  { id: 'tr74', price: 10000 },
  { id: 'tr75', price: 16000 },
  { id: 'tr76', price: 6000 },
  { id: 'tr77', price: 6000 },
  { id: 'tr78', price: 10000 },
  { id: 'tr79', price: 6000 },
  { id: 'tr80', price: 6000 },
  { id: 'tr81', price: 6000 },
  { id: 'tr82', price: 4000 },
  { id: 'tr83', price: 4000 },
  { id: 'tr84', price: 6000 },
  { id: 'tr85', price: 2000 },
  { id: 'tr86', price: 10000 },
  { id: 'tr87', price: 6000 },
  { id: 'tr88', price: 6000 },
  { id: 'tr89', price: 16000 },
  { id: 'tr90', price: 10000 },
  { id: 'tr91', price: 4000 },
  { id: 'tr92', price: 6000 },
  { id: 'tr93', price: 10000 },
  { id: 'tr94', price: 10000 },
  { id: 'tr95', price: 6000 },
  { id: 'tr96', price: 10000 },
  { id: 'tr97', price: 10000 },
  { id: 'tr98', price: 6000 },
  { id: 'tr99', price: 6000 },
  { id: 'train', price: 500000 },
  { id: 'trainTicket', price: 500000 },
  { id: 'tropicalShell', price: 2000 },
  { id: 'twistedSpoon', price: 1000 },
  { id: 'typeCandy', price: 15000 },
  { id: 'unremarkableTeacup', price: 400 },
  { id: 'upGrade', price: 2000 },
  { id: 'utilityUmbrella', price: 4000 },
  { id: 'vanillaCandy', price: 5000 },
  { id: 'venonatCandy', price: 20 },
  { id: 'voltorbCandy', price: 20 },
  { id: 'vulpixCandy', price: 20 },
  { id: 'wacanBerry', price: 80 },
  { id: 'waterGem', price: 200 },
  { id: 'waterStone', price: 2100 },
  { id: 'waveIncense', price: 2000 },
  { id: 'weaken', price: 250000 },
  { id: 'weaknessPolicy', price: 1000 },
  { id: 'weedleCandy', price: 20 },
  { id: 'whippedDream', price: 2000 },
  { id: 'whiteFlute', price: 20 },
  { id: 'whiteHerb', price: 4000 },
  { id: 'wideLens', price: 4000 },
  { id: 'wikiBerry', price: 80 },
  { id: 'wiseGlasses', price: 4000 },
  { id: 'xAccuracy', price: 1000 },
  { id: 'xAttack', price: 1000 },
  { id: 'xDefense', price: 2000 },
  { id: 'xSpAtk', price: 1000 },
  { id: 'xSpDef', price: 2000 },
  { id: 'xSpeed', price: 1000 },
  { id: 'yacheBerry', price: 80 },
  { id: 'yellowNectar', price: 300 },
  { id: 'yellowShard', price: 200 },
  { id: 'zapPlate', price: 1000 },
  { id: 'zapdosCandy', price: 20 },
  { id: 'zinc', price: 9800 },
  { id: 'zoomLens', price: 4000 },
  { id: 'zubatCandy', price: 20 },
];

const priceMap = new Map(ITEMS.map(i => [i.id, i.price]));

/** Экспорт для теста паритета цен (vitest): клиент обязан совпадать. */
export const SERVER_PRICE_MAP = priceMap;

// ── Рецепты крафта (14 штук) ─────────────────────────────────
interface Recipe {
  id: string; ingredients: Record<string, number>; result: string; qty: number;
}
const CRAFTING_RECIPES: Recipe[] = [
  { id: 'metalIngot', ingredients: { 'ore': 3 }, result: 'metalIngot', qty: 1 },
  { id: 'glass', ingredients: { 'mountainSand': 2, 'coal': 1 }, result: 'glass', qty: 1 },
  { id: 'bandage', ingredients: { 'cotton': 3 }, result: 'bandage', qty: 1 },
  { id: 'healingPotionCraft', ingredients: { 'healingHerbs': 2, 'wonderFlower': 1 }, result: 'potion', qty: 1 },
  { id: 'sparkles', ingredients: { 'shinyDust': 3, 'metalIngot': 1 }, result: 'sparkles', qty: 1 },
  { id: 'honeyJar', ingredients: { 'honeycomb': 2, 'woodenApricorn': 1 }, result: 'honeyJar', qty: 1 },
  { id: 'fossilRevive', ingredients: { 'suspiciousEgg': 1, 'ancientGenome': 1 }, result: 'fossil', qty: 1 },
  { id: 'craftPokeball', ingredients: { 'woodenApricorn': 1, 'metalIngot': 1 }, result: 'pokeBall', qty: 3 },
  { id: 'craftGreatBall', ingredients: { 'woodenApricorn': 2, 'metalIngot': 1, 'shinyDust': 1 }, result: 'greatBall', qty: 2 },
  { id: 'craftProtein', ingredients: { 'healingHerbs': 2, 'honeycomb': 1, 'ore': 1 }, result: 'protein', qty: 1 },
  { id: 'craftIron', ingredients: { 'ore': 2, 'metalIngot': 1 }, result: 'iron', qty: 1 },
  { id: 'craftOran', ingredients: { 'cotton': 1, 'honeycomb': 1 }, result: 'oranBerry', qty: 3 },
  { id: 'craftWeakElixir', ingredients: { 'healingHerbs': 2, 'wonderFlower': 1 }, result: 'ether', qty: 1 },
  { id: 'craftElixir', ingredients: { 'healingHerbs': 3, 'wonderFlower': 2, 'honeycomb': 1 }, result: 'elixir', qty: 1 },
];

// ── Хелпер: получить save_data пользователя ──────────────────
async function getUserData(userId: number) {
  const db = getDb();
  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!user) throw new Error('User not found');
  const saveData = parseSaveStrict(user.save_data, user.id)
  if (!saveData.inventory) saveData.inventory = {};
  return { user, saveData };
}

// ── POST /economy/buy ────────────────────────────────────────
router.post('/buy', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { itemId, qty } = req.body;
    if (!itemId || typeof qty !== 'number' || qty < 1 || !Number.isInteger(qty)) {
      res.status(400).json({ error: 'Invalid itemId or qty' });
      return;
    }

    const price = priceMap.get(itemId);
    if (!price || price <= 0) {
      res.status(400).json({ error: 'Item not available for purchase' });
      return;
    }

    const db = getDb();
    const userId = req.user!.userId;

    // Транзакция: read → check → write атомарно
    const result = await db.transaction(async (tx) => {
      const user = (await tx.select().from(users).where(eq(users.id, userId)).for('update').limit(1))[0];
      if (!user) throw new Error('User not found');
      const saveData = parseSaveStrict(user.save_data, user.id)
      if (!saveData.inventory) saveData.inventory = {};

      const currentMoney = saveData.inventory['credit'] || 0;
      // free_shop (админка): магазин бесплатный — деньги не проверяем и не списываем
      const freeShop = await isFeatureOn(db, 'free_shop');
      const total = freeShop ? 0 : price * qty;

      if (currentMoney < total) {
        throw new Error('Not enough credits');
      }

      saveData.inventory['credit'] = currentMoney - total;
      saveData.inventory[itemId] = (saveData.inventory[itemId] || 0) + qty;

      await (tx.update(users) as any).set({
        save_data: JSON.stringify(stampSave(saveData)),
        money: saveData.inventory['credit'],
      }).where(eq(users.id, userId));

      return saveData.inventory['credit'];
    });

    res.json({ money: result });
  } catch (err: any) {
    if (err.message === 'Not enough credits') {
      res.status(400).json({ error: 'Not enough credits' });
      return;
    }
    console.error('[economy/buy]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /economy/sell ───────────────────────────────────────
router.post('/sell', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { itemId, qty } = req.body;
    if (!itemId || typeof qty !== 'number' || qty < 1 || !Number.isInteger(qty) || itemId === 'credit') {
      res.status(400).json({ error: 'Invalid itemId or qty' });
      return;
    }

    const db = getDb();
    const userId = req.user!.userId;

    const result = await db.transaction(async (tx) => {
      const user = (await tx.select().from(users).where(eq(users.id, userId)).for('update').limit(1))[0];
      if (!user) throw new Error('User not found');
      const saveData = parseSaveStrict(user.save_data, user.id)
      if (!saveData.inventory) saveData.inventory = {};

      const currentQty = saveData.inventory[itemId] || 0;
      if (currentQty < qty) throw new Error('Not enough items');

      const price = priceMap.get(itemId);
      if (!price) throw new Error('Item cannot be sold');
      const sellPrice = Math.floor(price / 2);
      const totalEarned = sellPrice * qty;

      saveData.inventory[itemId] -= qty;
      if (saveData.inventory[itemId] <= 0) delete saveData.inventory[itemId];
      saveData.inventory['credit'] = (saveData.inventory['credit'] || 0) + totalEarned;

      await (tx.update(users) as any).set({
        save_data: JSON.stringify(stampSave(saveData)),
        money: saveData.inventory['credit'],
      }).where(eq(users.id, userId));

      return { money: saveData.inventory['credit'] };
    });

    res.json(result);
  } catch (err: any) {
    if (err.message === 'Not enough items') {
      res.status(400).json({ error: 'Not enough items' });
      return;
    }
    if (err.message === 'Item cannot be sold') {
      res.status(400).json({ error: 'Item cannot be sold' });
      return;
    }
    console.error('[economy/sell]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /economy/craft ──────────────────────────────────────
router.post('/craft', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { recipeId } = req.body;
    const recipe = CRAFTING_RECIPES.find(r => r.id === recipeId);
    if (!recipe) {
      res.status(400).json({ error: 'Unknown recipe' });
      return;
    }

    const db = getDb();
    const userId = req.user!.userId;

    const inventory = await db.transaction(async (tx) => {
      const user = (await tx.select().from(users).where(eq(users.id, userId)).for('update').limit(1))[0];
      if (!user) throw new Error('User not found');
      const saveData = parseSaveStrict(user.save_data, user.id)
      if (!saveData.inventory) saveData.inventory = {};

      // Проверить ингредиенты
      for (const [ingId, ingQty] of Object.entries(recipe.ingredients)) {
        const have = saveData.inventory[ingId] || 0;
        if (have < ingQty) {
          throw new Error(`Not enough ${ingId}`);
        }
      }

      // Списать ингредиенты
      for (const [ingId, ingQty] of Object.entries(recipe.ingredients)) {
        saveData.inventory[ingId] -= ingQty;
        if (saveData.inventory[ingId] <= 0) delete saveData.inventory[ingId];
      }

      // Выдать результат
      saveData.inventory[recipe.result] = (saveData.inventory[recipe.result] || 0) + recipe.qty;

      await (tx.update(users) as any).set({
        save_data: JSON.stringify(stampSave(saveData)),
      }).where(eq(users.id, userId));

      return saveData.inventory;
    });

    // Клиент ожидает ВЕСЬ inventory
    res.json({ inventory });
  } catch (err: any) {
    if (err.message && err.message.startsWith('Not enough ')) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error('[economy/craft]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /economy/reward ─────────────────────────────────────
router.post('/reward', authMiddleware, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const userId = req.user!.userId;

    const result = await db.transaction(async (tx) => {
      const user = (await tx.select().from(users).where(eq(users.id, userId)).for('update').limit(1))[0];
      if (!user) throw new Error('User not found');
      const saveData = parseSaveStrict(user.save_data, user.id)
      if (!saveData.inventory) saveData.inventory = {};

      // Проверка кулдауна (24h) по серверной колонке, а не по клиентскому полю:
      // lastRewardTime в save_data затирался каждым обычным сохранением клиента.
      const now = Date.now();
      const cooldownMs = 24 * 60 * 60 * 1000; // 24 ч
      const lastRewardAt = Number(user.last_reward_at || 0);
      const timeSinceLastReward = now - lastRewardAt;
      if (timeSinceLastReward < cooldownMs) {
        const hoursLeft = Math.ceil((cooldownMs - timeSinceLastReward) / (60 * 60 * 1000));
        throw new Error(`Reward cooldown: ${hoursLeft}h remaining`);
      }

      // Что получить: 500 кред. + 5 покеболов + 3 аптечки
      const rewardMoney = 500;
      const rewardItems = { pokeBall: 5, potion: 3 };

      saveData.inventory['credit'] = (saveData.inventory['credit'] || 0) + rewardMoney;
      for (const [itemId, qty] of Object.entries(rewardItems)) {
        saveData.inventory[itemId] = (saveData.inventory[itemId] || 0) + qty;
      }

      await (tx.update(users) as any).set({
        save_data: JSON.stringify(stampSave(saveData)),
        money: saveData.inventory['credit'],
        last_reward_at: now,
      }).where(eq(users.id, userId));

      return { rewardMoney, rewardItems };
    });

    res.json({ ok: true, money: result.rewardMoney, items: result.rewardItems });
  } catch (err: any) {
    if (err.message && err.message.startsWith('Reward cooldown:')) {
      res.status(429).json({ error: err.message });
      return;
    }
    console.error('[economy/reward]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Данные лидеров залов для server-authoritative наград ──
const GYM_LEADERS: Record<string, { badgeName: string; moneyReward: number; rewardItem?: string; rewardQty?: number }> = {
  pewterStadium: { badgeName: 'Boulder Badge', moneyReward: 4000, rewardItem: 'fullRestore', rewardQty: 1 },
  ceruleanStadium: { badgeName: 'Cascade Badge', moneyReward: 5000, rewardItem: 'superPotion', rewardQty: 1 },
  vermilionStadium: { badgeName: 'Thunder Badge', moneyReward: 6000, rewardItem: 'elixir', rewardQty: 1 },
  celadonStadium: { badgeName: 'Rainbow Badge', moneyReward: 7000, rewardItem: 'hyperPotion', rewardQty: 1 },
  saffronPsychicStadium: { badgeName: 'Marsh Badge', moneyReward: 8000, rewardItem: 'maxPotion', rewardQty: 1 },
  fuchsiaPoisonStadium: { badgeName: 'Soul Badge', moneyReward: 9000, rewardItem: 'fullRestore', rewardQty: 2 },
  cinnabarStadium: { badgeName: 'Volcano Badge', moneyReward: 10000, rewardItem: 'fullRestore', rewardQty: 1 },
  viridianStadium: { badgeName: 'Earth Badge', moneyReward: 11000, rewardItem: 'fullRestore', rewardQty: 1 },
  violetStadium: { badgeName: 'Zephyr Badge', moneyReward: 12000, rewardItem: 'superPotion', rewardQty: 1 },
  azaleaStadium: { badgeName: 'Hive Badge', moneyReward: 13000, rewardItem: 'elixir', rewardQty: 1 },
  goldenrodStadium: { badgeName: 'Plain Badge', moneyReward: 14000, rewardItem: 'hyperPotion', rewardQty: 1 },
  ecruteakStadium: { badgeName: 'Fog Badge', moneyReward: 15000, rewardItem: 'fullHeal', rewardQty: 1 },
  cianwoodStadium: { badgeName: 'Storm Badge', moneyReward: 16000, rewardItem: 'maxPotion', rewardQty: 1 },
  olivineStadium: { badgeName: 'Mineral Badge', moneyReward: 17000, rewardItem: 'fullRestore', rewardQty: 1 },
  mahoganyStadium: { badgeName: 'Glacier Badge', moneyReward: 18000, rewardItem: 'fullRestore', rewardQty: 1 },
  blackthornStadium: { badgeName: 'Rising Badge', moneyReward: 20000, rewardItem: 'fullRestore', rewardQty: 1 },
};

/**
 * POST /economy/badge-reward — server-authoritative награда за победу над лидером зала.
 *
 * Тело запроса: { locId: string }
 * Сервер проверяет:
 *   1. locId — известный лидер зала
 *   2. Игрок ещё не получал этот бадж
 *   3. Выдаёт бадж + деньги + предмет в БД
 */
router.post('/badge-reward', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { locId } = req.body;
    if (!locId || !GYM_LEADERS[locId]) {
      res.status(400).json({ error: 'Invalid gym location' });
      return;
    }

    const leader = GYM_LEADERS[locId];
    const userId = req.user!.userId;
    const db = getDb();

    const result = await db.transaction(async (tx) => {
      const user = (await tx.select().from(users).where(eq(users.id, userId)).for('update').limit(1))[0];
      if (!user) throw new Error('User not found');

      const saveData = parseSaveStrict(user.save_data, user.id)
      if (!saveData.inventory) saveData.inventory = {};
      if (!saveData.badges) saveData.badges = [];

      // ── Проверка: бадж уже есть? ──
      if (saveData.badges.includes(leader.badgeName)) {
        throw new Error(`Badge already awarded: ${leader.badgeName}`);
      }

      // ── Выдаём награду ──
      saveData.badges.push(leader.badgeName);
      saveData.inventory['credit'] = (saveData.inventory['credit'] || 0) + leader.moneyReward;

      if (leader.rewardItem) {
        saveData.inventory[leader.rewardItem] = (saveData.inventory[leader.rewardItem] || 0) + (leader.rewardQty || 1);
      }

      await (tx.update(users) as any).set({
        save_data: JSON.stringify(stampSave(saveData)),
        money: saveData.inventory['credit'],
        badges_count: saveData.badges.length,
      }).where(eq(users.id, userId));

      return {
        badgeName: leader.badgeName,
        moneyReward: leader.moneyReward,
        rewardItem: leader.rewardItem,
        rewardQty: leader.rewardQty,
      };
    });

    res.json({ ok: true, ...result });
  } catch (err: any) {
    if (err.message?.startsWith('Badge already awarded')) {
      res.status(409).json({ error: err.message });
      return;
    }
    console.error('[economy/badge-reward]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

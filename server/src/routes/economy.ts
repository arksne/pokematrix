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
  { id: 'abilityCapsule', price: 500000 },
  { id: 'abilityPatch', price: 1000000 },
  { id: 'absorbBulb', price: 4000 },
  { id: 'adrenalineOrb', price: 4000 },
  { id: 'airBalloon', price: 4000 },
  { id: 'amuletCoin', price: 10000 },
  { id: 'antiSputin', price: 400 },
  { id: 'antidote', price: 200 },
  { id: 'arenaToken', price: 100000 },
  { id: 'assaultVest', price: 1000000 },
  { id: 'awakening', price: 20000 },
  { id: 'berryJuice', price: 20000 },
  { id: 'berrySweet', price: 500 },
  { id: 'bigMalasada', price: 400 },
  { id: 'bigRoot', price: 4000 },
  { id: 'blackAugurite', price: 8000 },
  { id: 'blackBelt', price: 100000 },
  { id: 'blackFlute', price: 100000 },
  { id: 'blackGlasses', price: 100000 },
  { id: 'blackSludge', price: 4000 },
  { id: 'blunderPolicy', price: 4000 },
  { id: 'brightPowder', price: 4000 },
  { id: 'burnHeal', price: 200 },
  { id: 'calcium', price: 30000 },
  { id: 'carbos', price: 30000 },
  { id: 'casteliacone', price: 400 },
  { id: 'cellBattery', price: 4000 },
  { id: 'charcoal', price: 100000 },
  { id: 'chippedPot', price: 38000 },
  { id: 'choiceBand', price: 4000 },
  { id: 'choiceScarf', price: 4000 },
  { id: 'choiceSpecs', price: 4000 },
  { id: 'cleverWing', price: 300 },
  { id: 'cloverSweet', price: 500 },
  { id: 'commonCandy', price: 35000 },
  { id: 'typeCandyBox', price: 300000 },
  { id: 'crackedPot', price: 1600 },
  { id: 'craftersKit', price: 3000 },
  { id: 'credit', price: 0 },
  { id: 'darkBall', price: 50000 },
  { id: 'dawnStone', price: 100000 },
  { id: 'deepSeaScale', price: 250000 },
  { id: 'deepSeaTooth', price: 250000 },
  { id: 'destinyKnot', price: 4000 },
  { id: 'dracoPlate', price: 500000 },
  { id: 'dragonFang', price: 500000 },
  { id: 'dragonScale', price: 200000 },
  { id: 'dreadPlate', price: 500000 },
  { id: 'dubiousDisc', price: 100000 },
  { id: 'duskBall', price: 500 },
  { id: 'duskStone', price: 100000 },
  { id: 'evolutionStone', price: 20000 },
  { id: 'earthPlate', price: 500000 },
  { id: 'electirizer', price: 200000 },
  { id: 'electricSeed', price: 50000 },
  { id: 'elixir', price: 1200 },
  { id: 'energyPowder', price: 10000 },
  { id: 'energyRoot', price: 1500 },
  { id: 'escapeRope', price: 100000 },
  { id: 'ether', price: 600 },
  { id: 'evBrace', price: 25000000 },
  { id: 'everstone', price: 3000 },
  { id: 'eviolite', price: 4000 },

  { id: 'expertBelt', price: 4000 },
  { id: 'ferryTicket', price: 300000 },
  { id: 'fireStone', price: 100000 },
  { id: 'fistPlate', price: 500000 },
  { id: 'flameOrb', price: 4000 },
  { id: 'flamePlate', price: 500000 },
  { id: 'flowerSweet', price: 500 },
  { id: 'fluffyTail', price: 100000 },
  { id: 'focusBand', price: 4000 },
  { id: 'focusSash', price: 4000 },
  { id: 'freshWater', price: 10000 },
  { id: 'friendBall', price: 500 },
  { id: 'fullHeal', price: 400 },
  { id: 'fullRestore', price: 100000 },
  { id: 'geniusWing', price: 300 },
  { id: 'goodRod', price: 200000 },
  { id: 'grassySeed', price: 50000 },
  { id: 'greatBall', price: 300 },
  { id: 'gripClaw', price: 150000 },
  { id: 'hardStone', price: 1000 },
  { id: 'healPowder', price: 400 },
  { id: 'healingHerb', price: 400 },
  { id: 'healthWing', price: 300 },
  { id: 'hpUp', price: 9800 },
  { id: 'hyperPotion', price: 1500 },
  { id: 'iceHeal', price: 200 },
  { id: 'iceStone', price: 100000 },
  { id: 'iciclePlate', price: 500000 },
  { id: 'insectPlate', price: 500000 },
  { id: 'iron', price: 30000 },
  { id: 'ironPlate', price: 500000 },
  { id: 'kingsRock', price: 5000 },
  { id: 'lavaCookie', price: 400 },
  { id: 'leafStone', price: 100000 },
  { id: 'leftovers', price: 4000 },
  { id: 'lemonade', price: 15000 },
  { id: 'lifeOrb', price: 4000 },
  { id: 'lightBall', price: 100000 },
  { id: 'linkingCord', price: 80000 },
  { id: 'loveSweet', price: 5000 },
  { id: 'luckIncense', price: 11000 },
  { id: 'luckyEgg', price: 0 },
  { id: 'luminousMoss', price: 4000 },
  { id: 'lumioseGalette', price: 400 },
  { id: 'loveBall', price: 800 },
  { id: 'lure', price: 100000 },
  { id: 'magmarizer', price: 200000 },
  { id: 'magnet', price: 100000 },
  { id: 'maliciousArmor', price: 750000 },
  { id: 'masterpieceTeacup', price: 950000 },
  { id: 'maxElixir', price: 4500 },
  { id: 'maxEther', price: 2000 },
  { id: 'maxHoney', price: 50000 },
  { id: 'maxLure', price: 300000 },
  { id: 'maxPotion', price: 50000 },
  { id: 'maxRepel', price: 300000 },
  { id: 'maxRevive', price: 4000 },
  { id: 'meadowPlate', price: 500000 },
  { id: 'mentalHerb', price: 4000 },
  { id: 'metalAlloy', price: 800000 },
  { id: 'metalCoat', price: 250000 },
  { id: 'metalPowder', price: 100000 },
  { id: 'metronome', price: 4000 },
  { id: 'mindPlate', price: 500000 },
  { id: 'miracleSeed', price: 100000 },
  { id: 'mistySeed', price: 50000 },
  { id: 'moomooMilk', price: 1000 },
  { id: 'moonStone', price: 210000 },
  { id: 'muscleBand', price: 4000 },
  { id: 'muscleWing', price: 300 },
  { id: 'mysticWater', price: 100000 },
  { id: 'nestBall', price: 100 },
  { id: 'netBall', price: 100 },
  { id: 'neverMeltIce', price: 100000 },
  { id: 'oddIncense', price: 2000 },
  { id: 'oldGateau', price: 400 },
  { id: 'oldRod', price: 120000 },
  { id: 'ovalStone', price: 2000000 },
  { id: 'paralyzeHeal', price: 200 },
  { id: 'peatBlock', price: 800000 },
  { id: 'pewterCrunchies', price: 400 },
  { id: 'pixiePlate', price: 500000 },
  { id: 'poisonBarb', price: 100000 },
  { id: 'pokeBall', price: 100 },
  { id: 'pokeDoll', price: 200000 },
  { id: 'pokeToy', price: 100000 },
  { id: 'potion', price: 300 },
  { id: 'powerHerb', price: 4000 },
  { id: 'ppMax', price: 10000 },
  { id: 'ppUp', price: 6400 },
  { id: 'premierBall', price: 100 },
  { id: 'prismScale', price: 100000 },
  { id: 'protector', price: 100000 },
  { id: 'protein', price: 30000 },
  { id: 'psychicSeed', price: 50000 },
  { id: 'punchingGlove', price: 15000 },
  { id: 'quickBall', price: 800 },
  { id: 'quickClaw', price: 4000 },
  { id: 'quickPowder', price: 100000 },
  { id: 'rareCandy', price: 800000 },
  { id: 'razorClaw', price: 5000 },
  { id: 'razorFang', price: 5000 },
  { id: 'reaperCloth', price: 100000 },
  { id: 'repeatBall', price: 100 },
  { id: 'repel', price: 100000 },
  { id: 'resistWing', price: 300 },
  { id: 'revivalHerb', price: 20000 },
  { id: 'revive', price: 2000 },
  { id: 'ribbonSweet', price: 500 },
  { id: 'rockIncense', price: 2000 },
  { id: 'rockyHelmet', price: 4000 },
  { id: 'roseIncense', price: 2000 },
  { id: 'sachet', price: 100000 },
  { id: 'sacredAsh', price: 50000 },
  { id: 'safariBall', price: 1000000 },
  { id: 'scopeLens', price: 4000 },
  { id: 'seaIncense', price: 2000 },
  { id: 'shalourSable', price: 400 },
  { id: 'sharpBeak', price: 100000 },
  { id: 'shellBell', price: 4000 },
  { id: 'shinyStone', price: 2100000 },
  { id: 'silkScarf', price: 10000 },
  { id: 'silverPowder', price: 100000 },
  { id: 'skyPlate', price: 500000 },
  { id: 'snowball', price: 4000 },
  { id: 'sodaPop', price: 10000 },
  { id: 'softSand', price: 100000 },
  { id: 'spellTag', price: 100000 },
  { id: 'splashPlate', price: 500000 },
  { id: 'spookyPlate', price: 500000 },
  { id: 'sportBall', price: 100 },
  { id: 'starSweet', price: 500 },
  { id: 'stick', price: 100000 },
  { id: 'stickyBarb', price: 150000 },
  { id: 'stonePlate', price: 500000 },
  { id: 'strawberrySweet', price: 500 },
  { id: 'sunStone', price: 210000 },
  { id: 'superDarkBall', price: 500000 },
  { id: 'superLure', price: 200000 },
  { id: 'superPotion', price: 700 },
  { id: 'superRepel', price: 200000 },
  { id: 'superRod', price: 1000000 },
  { id: 'sweetApple', price: 2200 },
  { id: 'sweetHeart', price: 5000 },
  { id: 'swiftWing', price: 300 },
  { id: 'syrupyApple', price: 500 },
  { id: 'tartApple', price: 2200 },
  { id: 'thickClub', price: 100000 },
  { id: 'throatSpray', price: 4000 },
  { id: 'thunderStone', price: 100000 },
  { id: 'timerBall', price: 800 },
  { id: 'tm01', price: 1620000 },
  { id: 'tm02', price: 2460000 },
  { id: 'tm03', price: 2460000 },
  { id: 'tm04', price: 3730000 },
  { id: 'tm05', price: 200000 },
  { id: 'tm06', price: 2460000 },
  { id: 'tm07', price: 700000 },
  { id: 'tm08', price: 1070000 },
  { id: 'tm09', price: 1070000 },
  { id: 'tm10', price: 1070000 },
  { id: 'tm100', price: 5600000 },
  { id: 'tm101', price: 1600000 },
  { id: 'tm102', price: 5670000 },
  { id: 'tm103', price: 700000 },
  { id: 'tm104', price: 3730000 },
  { id: 'tm105', price: 1070000 },
  { id: 'tm106', price: 1600000 },
  { id: 'tm107', price: 2460000 },
  { id: 'tm108', price: 1620000 },
  { id: 'tm109', price: 700000 },
  { id: 'tm11', price: 860000 },
  { id: 'tm110', price: 1990000 },
  { id: 'tm111', price: 860000 },
  { id: 'tm112', price: 1600000 },
  { id: 'tm113', price: 700000 },
  { id: 'tm114', price: 1620000 },
  { id: 'tm115', price: 1310000 },
  { id: 'tm116', price: 700000 },
  { id: 'tm117', price: 1620000 },
  { id: 'tm118', price: 3730000 },
  { id: 'tm119', price: 2460000 },
  { id: 'tm12', price: 700000 },
  { id: 'tm120', price: 2460000 },
  { id: 'tm121', price: 700000 },
  { id: 'tm122', price: 700000 },
  { id: 'tm123', price: 1620000 },
  { id: 'tm124', price: 1600000 },
  { id: 'tm125', price: 3030000 },
  { id: 'tm126', price: 3030000 },
  { id: 'tm127', price: 2460000 },
  { id: 'tm128', price: 3730000 },
  { id: 'tm129', price: 3730000 },
  { id: 'tm13', price: 460000 },
  { id: 'tm130', price: 700000 },
  { id: 'tm131', price: 2430000 },
  { id: 'tm132', price: 700000 },
  { id: 'tm133', price: 2460000 },
  { id: 'tm134', price: 700000 },
  { id: 'tm135', price: 3030000 },
  { id: 'tm136', price: 1050000 },
  { id: 'tm137', price: 700000 },
  { id: 'tm138', price: 1050000 },
  { id: 'tm139', price: 1050000 },
  { id: 'tm14', price: 370000 },
  { id: 'tm140', price: 3730000 },
  { id: 'tm141', price: 6990000 },
  { id: 'tm142', price: 1990000 },
  { id: 'tm143', price: 3730000 },
  { id: 'tm144', price: 1600000 },
  { id: 'tm145', price: 1600000 },
  { id: 'tm146', price: 1600000 },
  { id: 'tm147', price: 1620000 },
  { id: 'tm148', price: 3030000 },
  { id: 'tm149', price: 2460000 },
  { id: 'tm15', price: 690000 },
  { id: 'tm150', price: 1310000 },
  { id: 'tm151', price: 2430000 },
  { id: 'tm152', price: 19890000 },
  { id: 'tm153', price: 20000000 },
  { id: 'tm154', price: 20000000 },
  { id: 'tm155', price: 20000000 },
  { id: 'tm156', price: 5670000 },
  { id: 'tm157', price: 13090000 },
  { id: 'tm158', price: 4600000 },
  { id: 'tm159', price: 13090000 },
  { id: 'tm16', price: 1070000 },
  { id: 'tm160', price: 5600000 },
  { id: 'tm161', price: 700000 },
  { id: 'tm162', price: 3690000 },
  { id: 'tm163', price: 19890000 },
  { id: 'tm164', price: 8510000 },
  { id: 'tm165', price: 15930000 },
  { id: 'tm166', price: 3730000 },
  { id: 'tm167', price: 13090000 },
  { id: 'tm168', price: 5670000 },
  { id: 'tm169', price: 19640000 },
  { id: 'tm17', price: 2460000 },
  { id: 'tm170', price: 19640000 },
  { id: 'tm171', price: 2460000 },
  { id: 'tm172', price: 700000 },
  { id: 'tm173', price: 1050000 },
  { id: 'tm174', price: 1050000 },
  { id: 'tm175', price: 3690000 },
  { id: 'tm176', price: 460000 },
  { id: 'tm177', price: 700000 },
  { id: 'tm178', price: 1050000 },
  { id: 'tm179', price: 570000 },
  { id: 'tm18', price: 460000 },
  { id: 'tm180', price: 1050000 },
  { id: 'tm181', price: 570000 },
  { id: 'tm182', price: 690000 },
  { id: 'tm183', price: 1050000 },
  { id: 'tm184', price: 850000 },
  { id: 'tm185', price: 2430000 },
  { id: 'tm186', price: 2990000 },
  { id: 'tm187', price: 300000 },
  { id: 'tm188', price: 2990000 },
  { id: 'tm189', price: 1050000 },
  { id: 'tm19', price: 300000 },
  { id: 'tm190', price: 10490000 },
  { id: 'tm191', price: 1620000 },
  { id: 'tm192', price: 19890000 },
  { id: 'tm193', price: 300000 },
  { id: 'tm194', price: 560000 },
  { id: 'tm195', price: 1970000 },
  { id: 'tm196', price: 690000 },
  { id: 'tm197', price: 300000 },
  { id: 'tm198', price: 5600000 },
  { id: 'tm199', price: 860000 },
  { id: 'tm20', price: 460000 },
  { id: 'tm200', price: 300000 },
  { id: 'tm201', price: 3690000 },
  { id: 'tm202', price: 700000 },
  { id: 'tm203', price: 700000 },
  { id: 'tm204', price: 5670000 },
  { id: 'tm205', price: 700000 },
  { id: 'tm206', price: 2430000 },
  { id: 'tm207', price: 1300000 },
  { id: 'tm208', price: 300000 },
  { id: 'tm209', price: 3690000 },
  { id: 'tm21', price: 690000 },
  { id: 'tm210', price: 3690000 },
  { id: 'tm211', price: 850000 },
  { id: 'tm212', price: 300000 },
  { id: 'tm213', price: 5600000 },
  { id: 'tm214', price: 5600000 },
  { id: 'tm215', price: 1970000 },
  { id: 'tm216', price: 3690000 },
  { id: 'tm217', price: 8510000 },
  { id: 'tm218', price: 1600000 },
  { id: 'tm219', price: 1070000 },
  { id: 'tm22', price: 460000 },
  { id: 'tm220', price: 8510000 },
  { id: 'tm221', price: 1990000 },
  { id: 'tm222', price: 1050000 },
  { id: 'tm223', price: 3690000 },
  { id: 'tm224', price: 700000 },
  { id: 'tm227', price: 1600000 },
  { id: 'tm228', price: 1300000 },
  { id: 'tm23', price: 460000 },
  { id: 'tm24', price: 460000 },
  { id: 'tm25', price: 700000 },
  { id: 'tm26', price: 850000 },
  { id: 'tm27', price: 460000 },
  { id: 'tm28', price: 700000 },
  { id: 'tm29', price: 570000 },
  { id: 'tm30', price: 570000 },
  { id: 'tm31', price: 690000 },
  { id: 'tm32', price: 460000 },
  { id: 'tm33', price: 460000 },
  { id: 'tm34', price: 570000 },
  { id: 'tm35', price: 570000 },
  { id: 'tm36', price: 700000 },
  { id: 'tm37', price: 460000 },
  { id: 'tm38', price: 690000 },
  { id: 'tm39', price: 860000 },
  { id: 'tm40', price: 690000 },
  { id: 'tm41', price: 200000 },
  { id: 'tm42', price: 700000 },
  { id: 'tm43', price: 700000 },
  { id: 'tm44', price: 690000 },
  { id: 'tm45', price: 570000 },
  { id: 'tm46', price: 460000 },
  { id: 'tm47', price: 700000 },
  { id: 'tm48', price: 1050000 },
  { id: 'tm49', price: 700000 },
  { id: 'tm50', price: 700000 },
  { id: 'tm51', price: 700000 },
  { id: 'tm52', price: 700000 },
  { id: 'tm53', price: 1050000 },
  { id: 'tm54', price: 1070000 },
  { id: 'tm55', price: 1070000 },
  { id: 'tm56', price: 200000 },
  { id: 'tm57', price: 200000 },
  { id: 'tm58', price: 860000 },
  { id: 'tm59', price: 1070000 },
  { id: 'tm60', price: 700000 },
  { id: 'tm61', price: 700000 },
  { id: 'tm62', price: 1990000 },
  { id: 'tm63', price: 1970000 },
  { id: 'tm64', price: 3730000 },
  { id: 'tm65', price: 860000 },
  { id: 'tm66', price: 2460000 },
  { id: 'tm67', price: 1620000 },
  { id: 'tm68', price: 1620000 },
  { id: 'tm69', price: 1620000 },
  { id: 'tm70', price: 700000 },
  { id: 'tm71', price: 1070000 },
  { id: 'tm72', price: 1050000 },
  { id: 'tm73', price: 860000 },
  { id: 'tm74', price: 700000 },
  { id: 'tm75', price: 700000 },
  { id: 'tm76', price: 200000 },
  { id: 'tm77', price: 1070000 },
  { id: 'tm78', price: 1600000 },
  { id: 'tm79', price: 1070000 },
  { id: 'tm80', price: 700000 },
  { id: 'tm81', price: 700000 },
  { id: 'tm82', price: 5670000 },
  { id: 'tm83', price: 1990000 },
  { id: 'tm84', price: 860000 },
  { id: 'tm85', price: 700000 },
  { id: 'tm86', price: 860000 },
  { id: 'tm87', price: 700000 },
  { id: 'tm88', price: 3730000 },
  { id: 'tm89', price: 1070000 },
  { id: 'tm90', price: 1050000 },
  { id: 'tm91', price: 1050000 },
  { id: 'tm92', price: 700000 },
  { id: 'tm93', price: 1620000 },
  { id: 'tm94', price: 1070000 },
  { id: 'tm95', price: 1600000 },
  { id: 'tm96', price: 3690000 },
  { id: 'tm97', price: 1620000 },
  { id: 'tm98', price: 700000 },
  { id: 'tm99', price: 1070000 },
  { id: 'tmMid', price: 2000000 },
  { id: 'tmTop', price: 20000000 },
  { id: 'tmWeak', price: 200000 },
  { id: 'toxicOrb', price: 4000 },
  { id: 'toxicPlate', price: 500000 },
  { id: 'train', price: 500000 },
  { id: 'trainTicket', price: 200000 },
  { id: 'twistedSpoon', price: 100000 },
  { id: 'ultraBall', price: 600 },
  { id: 'unremarkableTeacup', price: 400 },
  { id: 'upGrade', price: 2000 },
  { id: 'vanillaCandy', price: 10000 },
  { id: 'waterStone', price: 100000 },
  { id: 'waveIncense', price: 2000 },
  { id: 'weaken', price: 250000 },
  { id: 'weaknessPolicy', price: 1000000 },
  { id: 'whippedDream', price: 100000 },
  { id: 'whiteFlute', price: 100000 },
  { id: 'whiteHerb', price: 4000 },
  { id: 'wiseGlasses', price: 4000 },
  { id: 'xAttack', price: 1000 },
  { id: 'xDefense', price: 1000 },
  { id: 'xSpAtk', price: 1000 },
  { id: 'xSpDef', price: 1000 },
  { id: 'xSpeed', price: 1000 },
  { id: 'zapPlate', price: 500000 },
  { id: 'zinc', price: 30000 },
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

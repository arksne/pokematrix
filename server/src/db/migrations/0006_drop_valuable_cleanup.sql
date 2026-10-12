-- 0006: valuable-категория удалена из игры — чистим дроп-конфиг.
-- universal_drops: только удалённые id (остальное, если админ что-то клал, живёт).
UPDATE "drop_config" SET "universal_drops" = COALESCE((
  SELECT json_agg(el)::text FROM json_array_elements("universal_drops"::json) el
  WHERE el->>'item' NOT IN ('balmMushroom','beachGlass','bigBambooShoot','bigMushroom','bigNugget','bigPearl','bottleCap','chalkyStone','cometShard','discountCoupon','goldBottleCap','goldLeaf','leafLetter-Eevee','leafLetter-Pikachu','loneEarring','marble','nugget','pearl','pearlString','polishedMudBall','prettyWing','rareBone','relicBand','relicCopper','relicCrown','relicGold','relicSilver','relicStatue','relicVase','silverLeaf','smallBouquet','stardust','starPiece','strangeSouvenir','stretchySpring','tinyBambooShoot','tinyMushroom','tropicalShell','blueShard','greenShard','heartScale','honey','redShard','yellowShard')
), '[]');
--> statement-breakpoint
-- monster_drops: вычищаем удалённые id из каждого массива, ключи мобов сохраняем.
UPDATE "drop_config" SET "monster_drops" = COALESCE((
  SELECT json_object_agg(k, v2)::text FROM (
    SELECT k, COALESCE((SELECT json_agg(el) FROM json_array_elements(v) el
      WHERE el->>'item' NOT IN ('balmMushroom','beachGlass','bigBambooShoot','bigMushroom','bigNugget','bigPearl','bottleCap','chalkyStone','cometShard','discountCoupon','goldBottleCap','goldLeaf','leafLetter-Eevee','leafLetter-Pikachu','loneEarring','marble','nugget','pearl','pearlString','polishedMudBall','prettyWing','rareBone','relicBand','relicCopper','relicCrown','relicGold','relicSilver','relicStatue','relicVase','silverLeaf','smallBouquet','stardust','starPiece','strangeSouvenir','stretchySpring','tinyBambooShoot','tinyMushroom','tropicalShell','blueShard','greenShard','heartScale','honey','redShard','yellowShard')), '[]') AS v2
    FROM json_each("monster_drops"::json) AS t(k, v)
  ) s
), '{}');

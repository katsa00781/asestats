-- Hunbasket ASCII-nagybetűsített vezetéknevek javítása a players táblában
--
-- Háttér (2026-09-27): a Hunbasket box-score / keret táblája 2026 januárja óta
-- a vezetéknevet ASCII-only nagybetűsítéssel adja („RéVéSZ Ádám”, „BUGLYó
-- Barna Gergő”), a scraper ezt változtatás nélkül mentette. A scraper javítva
-- (scrape-utils.ts cleanPlayerName → fixAsciiUppercasedName); ez a fájl a
-- meglévő 124 sort javítja („RÉVÉSZ Ádám”). Generálva a players táblából;
-- minden UPDATE id + régi név szerint védett (idempotens, ütközésmentes:
-- a lower(trim(name)) dedup-kulcs nem változik).
--
-- Futtatás: Supabase SQL Editor vagy ./scripts/run-sql.sh migrations/fix-hunbasket-uppercased-player-names.sql

BEGIN;

-- 2025/2026
UPDATE players SET name = 'BOGNÁR Kristóf' WHERE id = '1f1a4cbe-2b89-454e-ab24-ea234f39ebcb' AND name = 'BOGNáR Kristóf';
UPDATE players SET name = 'BŐSZE Gergő' WHERE id = 'bc838560-4ddb-4795-8509-e6c5bdcb1f0f' AND name = 'BőSZE Gergő';
UPDATE players SET name = 'BUZÁS Bence' WHERE id = 'f9249fc0-221c-4f6c-97ac-a572c873ade2' AND name = 'BUZáS Bence';
UPDATE players SET name = 'CSÁTALJAY Péter' WHERE id = '5a854b80-25c6-4f48-8e02-802605bc0984' AND name = 'CSáTALJAY Péter';
UPDATE players SET name = 'DÁVID Tamás' WHERE id = '3b385acd-4d02-4107-bb28-c5a6e05bd888' AND name = 'DáVID Tamás';
UPDATE players SET name = 'DÉKÁNY Boján Bendegúz' WHERE id = '65187031-d9d7-4eb4-9a3d-dc2c7061a84b' AND name = 'DéKáNY Boján Bendegúz';
UPDATE players SET name = 'DÓCS Benedek András' WHERE id = 'c9a3bfb4-ba79-42b7-90ab-6d062496f98a' AND name = 'DóCS Benedek András';
UPDATE players SET name = 'DURÁZI Krisztofer' WHERE id = '837060fb-c2f5-4c50-8fe7-2bce7532ac49' AND name = 'DURáZI Krisztofer';
UPDATE players SET name = 'FLASÁR Botond' WHERE id = '29f3b60a-3e55-4cf2-aea2-75c5cef84d42' AND name = 'FLASáR Botond';
UPDATE players SET name = 'FLASÁR Zalán' WHERE id = '441552a5-f929-4afb-85ea-efd23408bb65' AND name = 'FLASáR Zalán';
UPDATE players SET name = 'FONYÓ Botond' WHERE id = 'fea90cba-84b8-45c5-b4da-6ec5d5654f75' AND name = 'FONYó Botond';
UPDATE players SET name = 'GÁL Csongor' WHERE id = '308c4a7a-1a66-4918-9505-c7db94891441' AND name = 'GáL Csongor';
UPDATE players SET name = 'GARAMVÖLGYI Ákos Tibor' WHERE id = '36e39092-6d56-41b7-b123-b831013f1474' AND name = 'GARAMVöLGYI Ákos Tibor';
UPDATE players SET name = 'GÁSPÁR Benedek' WHERE id = 'bb2790c0-1b62-4819-9cee-87ba94d519cd' AND name = 'GáSPáR Benedek';
UPDATE players SET name = 'GÁSPÁR Mátyás' WHERE id = '4012c511-210e-4b45-9931-da646f513afe' AND name = 'GáSPáR Mátyás';
UPDATE players SET name = 'GYURÁKOVICS Ákos' WHERE id = '96e57e0d-fbff-4cf2-8b87-f13ad30c7a67' AND name = 'GYURáKOVICS Ákos';
UPDATE players SET name = 'HORVÁTH Ákos' WHERE id = 'c90b48cc-b4ba-4cba-bff2-951daf1a3e05' AND name = 'HORVáTH Ákos';
UPDATE players SET name = 'HŐGYE Patrik' WHERE id = 'aa2daca6-c5a5-4234-b162-6139f6554242' AND name = 'HőGYE Patrik';
UPDATE players SET name = 'KELENFÖLDI Domonkos' WHERE id = '7ec90ea5-21b5-49f4-8ba3-bd036f8ac97e' AND name = 'KELENFöLDI Domonkos';
UPDATE players SET name = 'KÓBOR László' WHERE id = '360c7b2f-7e69-4fcd-83e0-0cb34799fae7' AND name = 'KóBOR László';
UPDATE players SET name = 'KOLLÁR Bence' WHERE id = 'e9d4423a-cc6a-4939-87a5-946b7c8937e8' AND name = 'KOLLáR Bence';
UPDATE players SET name = 'KOPÁCSI Ákos' WHERE id = '4f93476a-7a41-4f3d-9ffe-a90a17577cf7' AND name = 'KOPáCSI Ákos';
UPDATE players SET name = 'KOVÁCS Ákos Bence' WHERE id = '43832c0a-0f3e-4b23-8198-05ed3efbc8c3' AND name = 'KOVáCS Ákos Bence';
UPDATE players SET name = 'KOVÁCS Áron' WHERE id = 'ab2b3eaa-6a63-445e-93f8-c7276c61448b' AND name = 'KOVáCS Áron';
UPDATE players SET name = 'KOVÁCS Áron Boldizsár' WHERE id = '76e0175a-b496-498c-a037-467154f5e967' AND name = 'KOVáCS Áron Boldizsár';
UPDATE players SET name = 'KOVÁCS Benedek Máté' WHERE id = '4dc22f04-869e-471d-a547-fb758a78b916' AND name = 'KOVáCS Benedek Máté';
UPDATE players SET name = 'KÖRMENDI Bence' WHERE id = '28cab41e-89af-43ed-8fd3-72e872f3dcee' AND name = 'KöRMENDI Bence';
UPDATE players SET name = 'KÖRTVÉLYESSY András Pál' WHERE id = '1e14e3de-8504-4c4f-b158-f56ba981344d' AND name = 'KöRTVéLYESSY András Pál';
UPDATE players SET name = 'KRISTYÁK Viktor' WHERE id = '2e4966a1-f9ee-49f2-919f-83b117de48a6' AND name = 'KRISTYáK Viktor';
UPDATE players SET name = 'LESTYÁK Benedek' WHERE id = 'd7763e8d-3e77-4997-b43d-3b64233dd9f7' AND name = 'LESTYáK Benedek';
UPDATE players SET name = 'LUKÁCSI Gábor' WHERE id = '607578ae-f18e-43c7-9f73-68bea0d48154' AND name = 'LUKáCSI Gábor';
UPDATE players SET name = 'MÉSZÁROS Tamás József' WHERE id = '314c36f5-7a14-4edf-87e8-463daedc7921' AND name = 'MéSZáROS Tamás József';
UPDATE players SET name = 'MESZLÉNYI Róbert Vilmos' WHERE id = '88e9f3d8-ea3f-4cd1-999e-ce703b803b81' AND name = 'MESZLéNYI Róbert Vilmos';
UPDATE players SET name = 'MEZŐFI Márk' WHERE id = 'ecfd35a7-1ddd-4344-964e-e32261401b7b' AND name = 'MEZőFI Márk';
UPDATE players SET name = 'MÓCSÁN Bálint' WHERE id = 'b65fb512-5528-4d52-b9cd-4334f89a3501' AND name = 'MóCSáN Bálint';
UPDATE players SET name = 'MOKÁNSZKI Máté' WHERE id = 'b2671669-88a0-40eb-a5cd-1efb513fe56a' AND name = 'MOKáNSZKI Máté';
UPDATE players SET name = 'MOLNÁR Márton' WHERE id = '44c86379-0f9e-42fa-997d-65ed09ab71bc' AND name = 'MOLNáR Márton';
UPDATE players SET name = 'NÉMETH Ákos' WHERE id = '6bad3fc7-1124-40cd-a669-865843dc518e' AND name = 'NéMETH Ákos';
UPDATE players SET name = 'PAÁR Márk' WHERE id = 'fec51475-e9b7-467c-878d-dd7a16d48541' AND name = 'PAáR Márk';
UPDATE players SET name = 'PÁRKÁNYI Máté' WHERE id = '6b12eafa-e6e1-45a5-a626-29441d69dfaf' AND name = 'PáRKáNYI Máté';
UPDATE players SET name = 'POLÁNYI Kristóf Áron' WHERE id = '1a0de0f8-7c34-429c-a3e9-779d9f17bcdd' AND name = 'POLáNYI Kristóf Áron';
UPDATE players SET name = 'PONGÓ Marcell' WHERE id = '3b6385fd-887a-489e-9ab8-05324763bdb1' AND name = 'PONGó Marcell';
UPDATE players SET name = 'PONGÓ Máté' WHERE id = 'cd0b3db2-1be6-4a62-ace1-fbb5f3b7bf1b' AND name = 'PONGó Máté';
UPDATE players SET name = 'RADÓ Ádám' WHERE id = '1c2f44e5-b235-47de-91be-17f0a5bcf44c' AND name = 'RADó Ádám';
UPDATE players SET name = 'RÁTGÉBER Tamás' WHERE id = 'f43bdeaa-3199-442a-a731-203e9221a0fb' AND name = 'RáTGéBER Tamás';
UPDATE players SET name = 'RÉVÉSZ Ádám' WHERE id = 'b0c4c436-5dfc-4ad0-9e87-f26ceaaed0c2' AND name = 'RéVéSZ Ádám';
UPDATE players SET name = 'RUJÁK András Baldvin' WHERE id = 'f045f537-c457-4a1a-8d8f-8f02483ee311' AND name = 'RUJáK András Baldvin';
UPDATE players SET name = 'SÁGODI Róbert' WHERE id = 'fe4c553a-52e3-482e-9e70-67194f2dba02' AND name = 'SáGODI Róbert';
UPDATE players SET name = 'SCHÖLL Richárd' WHERE id = '4853d139-58f0-41fb-a502-0caab3f4ce55' AND name = 'SCHöLL Richárd';
UPDATE players SET name = 'SEPPÄLÄ Ilari Petteri' WHERE id = '9152c255-49db-446d-ae68-fcd575ceb61a' AND name = 'SEPPäLä Ilari Petteri';
UPDATE players SET name = 'SÖVEGJÁRTÓ Ábel György' WHERE id = '19fe0d18-290b-4ea3-bd74-cc5c75659dab' AND name = 'SöVEGJáRTó Ábel György';
UPDATE players SET name = 'SZÁSZ-VERES Márk' WHERE id = '0afa1a1a-10d5-401a-93e7-2954c6d72522' AND name = 'SZáSZ-VERES Márk';
UPDATE players SET name = 'SZEMERÉDI Levente Béla' WHERE id = '5c75317c-3ce8-410a-8320-629de81cb5de' AND name = 'SZEMERéDI Levente Béla';
UPDATE players SET name = 'SZŐKE Bálint' WHERE id = '7cbde1a4-d9c6-4617-a1fd-33b413248a77' AND name = 'SZőKE Bálint';
UPDATE players SET name = 'TAKÁCS Kristóf' WHERE id = '359b5d1a-c132-40a0-95c0-debb282cc83e' AND name = 'TAKáCS Kristóf';
UPDATE players SET name = 'TAKÁCS Martin' WHERE id = 'ec2b25fd-ede4-431e-86a3-050aa881fba0' AND name = 'TAKáCS Martin';
UPDATE players SET name = 'TAKÁCS Milán' WHERE id = '6ded72c5-69ba-40b5-9219-a17e6a5732f7' AND name = 'TAKáCS Milán';
UPDATE players SET name = 'TAKÁCS Zsolt' WHERE id = '3135b787-ba83-4538-9ba7-28b0f2525ca8' AND name = 'TAKáCS Zsolt';
UPDATE players SET name = 'TARJÁN Izsák Simon' WHERE id = '7e381a63-58f2-4f4f-8bcd-36d563ba91e0' AND name = 'TARJáN Izsák Simon';
UPDATE players SET name = 'TÓTH Ádám' WHERE id = 'f198091d-ab8b-43b1-a3d8-8eb4c2668b32' AND name = 'TóTH Ádám';
UPDATE players SET name = 'TÓTH Barna' WHERE id = '0db3670f-0bca-47b4-ae4a-093d2995bf53' AND name = 'TóTH Barna';
UPDATE players SET name = 'TÖRÖK-PAPP Benedek' WHERE id = '5f04ac8d-05d4-4539-9cab-dbeaf4fac934' AND name = 'TöRöK-PAPP Benedek';
UPDATE players SET name = 'VÁMOS Ádám' WHERE id = 'e09cc860-2898-46e0-a0f2-140026d770f7' AND name = 'VáMOS Ádám';
UPDATE players SET name = 'VÁRADI Benedek' WHERE id = 'b7053aff-41a7-4373-bb5a-19beae23c382' AND name = 'VáRADI Benedek';
UPDATE players SET name = 'VÁRSZEGI Ádám' WHERE id = '945a1e2b-dddb-412b-b5b1-8138c1771723' AND name = 'VáRSZEGI Ádám';
UPDATE players SET name = 'VERASZTÓ Péter' WHERE id = '3efc0403-03bb-4ec0-b730-ceb906ba02fa' AND name = 'VERASZTó Péter';
UPDATE players SET name = 'VILMÁNYI Márton Gergő' WHERE id = 'c8cebac2-d82d-48f2-8a3d-3ac145d4bbe5' AND name = 'VILMáNYI Márton Gergő';
UPDATE players SET name = 'WÓJCIK Szymon Piotr' WHERE id = '28413ca8-f9d7-49e5-9b14-8bb724911c82' AND name = 'WóJCIK Szymon Piotr';
UPDATE players SET name = 'ZÖLDI Zétény István' WHERE id = 'd4433e2e-2f80-4d1e-90aa-785dcddfe027' AND name = 'ZöLDI Zétény István';
-- 2026/2027
UPDATE players SET name = 'BANKÓ Zoltán Martin' WHERE id = '24750fea-48ee-428a-95e9-278363408782' AND name = 'BANKó Zoltán Martin';
UPDATE players SET name = 'BÉKÉSI Benedek' WHERE id = '337ebd33-9e0c-4643-aa58-0c723acdd50f' AND name = 'BéKéSI Benedek';
UPDATE players SET name = 'BOGDÁN Benedek' WHERE id = '59f0e9f8-25cc-457a-adde-f824eda22634' AND name = 'BOGDáN Benedek';
UPDATE players SET name = 'BOGNÁR Kristóf' WHERE id = '94bb8fa8-a289-426d-916b-be4e32e67d00' AND name = 'BOGNáR Kristóf';
UPDATE players SET name = 'BŐSZE Gergő' WHERE id = '7ffe3b6c-0e9b-4ef3-bd86-7f2b622e8e59' AND name = 'BőSZE Gergő';
UPDATE players SET name = 'BUGLYÓ Barna Gergő' WHERE id = '170e453a-628c-44ce-82e0-cbc7b65ecbc2' AND name = 'BUGLYó Barna Gergő';
UPDATE players SET name = 'BUZÁS Bence' WHERE id = 'a57ccb8a-c4cd-46d2-898e-929ad54f8150' AND name = 'BUZáS Bence';
UPDATE players SET name = 'CSÁTALJAY Péter' WHERE id = 'b0e4f35c-a6fe-4aca-93da-01908cad8a07' AND name = 'CSáTALJAY Péter';
UPDATE players SET name = 'DÁVID Tamás' WHERE id = 'a62c7636-57f4-45ef-a77b-28e282b33df5' AND name = 'DáVID Tamás';
UPDATE players SET name = 'DÉKÁNY Boján Bendegúz' WHERE id = '2adab92e-3b03-4c85-b31c-3f38f6f8825a' AND name = 'DéKáNY Boján Bendegúz';
UPDATE players SET name = 'DÓCS Benedek András' WHERE id = '223516e8-635f-4f06-8649-3172c4f96266' AND name = 'DóCS Benedek András';
UPDATE players SET name = 'DURÁZI Krisztofer' WHERE id = 'b25c67d7-4482-444f-9fbd-831e1bdd86d9' AND name = 'DURáZI Krisztofer';
UPDATE players SET name = 'FLASÁR Botond' WHERE id = 'ffbb41e2-1869-41fa-8209-8c7d9059ed90' AND name = 'FLASáR Botond';
UPDATE players SET name = 'FORGÁCS Gábor' WHERE id = 'c0428412-dd66-48c1-b1a0-410161366c56' AND name = 'FORGáCS Gábor';
UPDATE players SET name = 'GÁL Csongor' WHERE id = 'ee83f7c5-f085-4987-b2a7-1a2502846c22' AND name = 'GáL Csongor';
UPDATE players SET name = 'GÉRINGER Gergő' WHERE id = 'b21f1fba-03fd-4be1-961d-a9944cbcc448' AND name = 'GéRINGER Gergő';
UPDATE players SET name = 'GYURÁKOVICS Ákos' WHERE id = 'acd401c9-5dc1-4509-92f2-bd22db3c4584' AND name = 'GYURáKOVICS Ákos';
UPDATE players SET name = 'HORVÁTH Roland Péter' WHERE id = '5bc1882c-3079-4047-9238-1e62d2d513ae' AND name = 'HORVáTH Roland Péter';
UPDATE players SET name = 'HŐGYE Patrik' WHERE id = '7741ee98-6278-4b47-898d-9833f01f590e' AND name = 'HőGYE Patrik';
UPDATE players SET name = 'HUSZÁR Balázs' WHERE id = '289d6d02-7b4c-4c8d-ada4-2f844aeae29f' AND name = 'HUSZáR Balázs';
UPDATE players SET name = 'KÉKESI Kristóf' WHERE id = '525c1d46-940a-4f13-8c2e-0a357c7f5754' AND name = 'KéKESI Kristóf';
UPDATE players SET name = 'KELENFÖLDI Domonkos' WHERE id = 'ff856f0b-f77b-4aa0-88ad-a3dd1673ef88' AND name = 'KELENFöLDI Domonkos';
UPDATE players SET name = 'KOVÁCS Ákos Bence' WHERE id = '0063db6d-ab0b-4112-9920-6dc8f6b96a7f' AND name = 'KOVáCS Ákos Bence';
UPDATE players SET name = 'KOVÁCS Áron' WHERE id = '3be2949e-2d58-4eef-b16d-adbdc8d2f279' AND name = 'KOVáCS Áron';
UPDATE players SET name = 'KOVÁCS Benedek Máté' WHERE id = 'c3d17340-fce5-4f3a-bfbb-ad335e982191' AND name = 'KOVáCS Benedek Máté';
UPDATE players SET name = 'KRISTYÁK Viktor' WHERE id = '6a839405-5594-4f81-b62d-27e082adf8a3' AND name = 'KRISTYáK Viktor';
UPDATE players SET name = 'LUKÁCSI Gábor' WHERE id = 'c8cb07e2-2920-4595-8938-1565f7aaf754' AND name = 'LUKáCSI Gábor';
UPDATE players SET name = 'MÉSZÁROS Tamás József' WHERE id = 'c09a19e9-6966-478f-b507-c55c2ff004dc' AND name = 'MéSZáROS Tamás József';
UPDATE players SET name = 'MESZLÉNYI Róbert Vilmos' WHERE id = '2e9ae8fa-9274-4e14-891a-65a7c3c9ce51' AND name = 'MESZLéNYI Róbert Vilmos';
UPDATE players SET name = 'MEZŐFI Márk' WHERE id = '0e7de691-f186-4613-a2e2-0ecc4c0b0bce' AND name = 'MEZőFI Márk';
UPDATE players SET name = 'MÓCSÁN Bálint' WHERE id = '55f5c661-2712-4631-ac6c-9820658086ae' AND name = 'MóCSáN Bálint';
UPDATE players SET name = 'MOLNÁR Márton' WHERE id = '9341898d-ae69-49f5-9d42-1a0ffbf9f196' AND name = 'MOLNáR Márton';
UPDATE players SET name = 'PAÁR Márk' WHERE id = 'b2fe34b2-1f8a-460b-98d8-e289f6c64a96' AND name = 'PAáR Márk';
UPDATE players SET name = 'PÁRKÁNYI Máté' WHERE id = 'bdb8e4f5-9a24-4209-aa3e-f9daaa4f9779' AND name = 'PáRKáNYI Máté';
UPDATE players SET name = 'PONGÓ Marcell' WHERE id = '6be696e2-07e8-4fe6-a574-9f729b200987' AND name = 'PONGó Marcell';
UPDATE players SET name = 'RADÓ Ádám' WHERE id = 'fb6a1314-04af-437a-9b25-165f01f0fe65' AND name = 'RADó Ádám';
UPDATE players SET name = 'RÁTGÉBER Tamás' WHERE id = '5cf9ea52-6f4d-4878-b2b4-62ed1ee9019b' AND name = 'RáTGéBER Tamás';
UPDATE players SET name = 'RÉVÉSZ Ádám' WHERE id = '7e473053-0cc9-4a47-bca3-464998d9f61c' AND name = 'RéVéSZ Ádám';
UPDATE players SET name = 'RUJÁK András Baldvin' WHERE id = '3b562f12-54a1-4577-ab5a-eb94992758b1' AND name = 'RUJáK András Baldvin';
UPDATE players SET name = 'SÁGODI Róbert' WHERE id = '92f0bb07-8ddd-4dda-aefd-2a7e66923530' AND name = 'SáGODI Róbert';
UPDATE players SET name = 'SZABÓ Lehel' WHERE id = '96f05a9e-293d-4553-b3fe-1005772a7b70' AND name = 'SZABó Lehel';
UPDATE players SET name = 'SZABÓ Zoltán' WHERE id = 'fcfb8c1a-ff88-4a63-a1a3-2b8306bce492' AND name = 'SZABó Zoltán';
UPDATE players SET name = 'SZÁSZ-VERES Márk' WHERE id = 'e7db65f5-f13a-4c87-99a8-274e06f79c0a' AND name = 'SZáSZ-VERES Márk';
UPDATE players SET name = 'SZEMERÉDI Levente Béla' WHERE id = 'e6e8c8cb-8a2e-48c8-8b0d-5422c31d8290' AND name = 'SZEMERéDI Levente Béla';
UPDATE players SET name = 'SZŐKE Bálint' WHERE id = '24b457b2-5a47-4a76-81a8-2620681a0c86' AND name = 'SZőKE Bálint';
UPDATE players SET name = 'TAKÁCS Kristóf' WHERE id = '1216ce92-56bc-4753-b8f3-7dda95f32849' AND name = 'TAKáCS Kristóf';
UPDATE players SET name = 'TAKÁCS Martin' WHERE id = '017415a1-46e6-4a0e-9253-e1eff58a34ae' AND name = 'TAKáCS Martin';
UPDATE players SET name = 'TAKÁCS Zsolt' WHERE id = '8f5274a8-1518-4e74-aed2-11bfdbb5788a' AND name = 'TAKáCS Zsolt';
UPDATE players SET name = 'TARJÁN Izsák Simon' WHERE id = '50fdfab3-0b55-4231-9bbd-443777b17afe' AND name = 'TARJáN Izsák Simon';
UPDATE players SET name = 'TURCSÁNYI Nándor' WHERE id = '1bb3e91a-c677-4eeb-bb23-643271cf5e8c' AND name = 'TURCSáNYI Nándor';
UPDATE players SET name = 'VÁRADI Benedek' WHERE id = 'd6f46818-eb12-4f52-91a7-94cba55daffe' AND name = 'VáRADI Benedek';
UPDATE players SET name = 'VÁRSZEGI Ádám' WHERE id = '04465fc3-bcd9-41a5-b400-ce00b5d2a9be' AND name = 'VáRSZEGI Ádám';
UPDATE players SET name = 'VERASZTÓ Péter' WHERE id = '2d17d431-a5ed-4c77-ac1f-4e2ba9b40a94' AND name = 'VERASZTó Péter';
UPDATE players SET name = 'VILMÁNYI Márton Gergő' WHERE id = '751087db-32e6-4c85-b283-9582f9a2e726' AND name = 'VILMáNYI Márton Gergő';
UPDATE players SET name = 'ZÖLDI Zétény István' WHERE id = 'e406e344-fbd8-46ad-9642-19a878e1630b' AND name = 'ZöLDI Zétény István';

-- Ellenőrzés: 0 sor maradhat hibás (ASCII kisbetű nélküli, ékezetes kisbetűs szótag)
SELECT count(*) AS remaining_broken FROM players
WHERE EXISTS (
  SELECT 1 FROM regexp_split_to_table(name, ' ') AS tok
  WHERE tok !~ '[a-z]' AND tok ~ '[A-Z].*[A-Z]' AND tok ~ '[áéíóöőúüűä]'
);

COMMIT;

-- =====================================================================
-- fix-delete-2024-25-leftover-players-from-2025-26-season.sql
-- KÉZZEL FUTTATANDÓ a Supabase SQL Editorban! (adattartalom-javítás, H22 utómunka)
--
-- Előzmény: a 2026-02-07-i és 2026-04-20-i box-score / dobástérkép importok a
-- 2024/2025-ös Hunbasket sluggal (x2425) futottak, de a 2025/2026-os szezonba
-- írtak. A meccsek, statisztikák és dobások már rendben vannak
-- (fix-remove-2024-25-games-from-2025-26-season.sql,
-- fix-move-2024-25-shotcharts-from-2025-26-season.sql), de maradt:
--   - 74 `players` sor a 2025/2026 szezonban, amely a 2024/2025-ös keretből
--     került oda: mindegyiknek van azonos csapat + név párja 2024/2025-ben,
--     és a Kosarstat szezonos keret-adatai (`league_player_team_seasons`)
--     szerint egyik sem volt az adott csapat 2025/2026-os keretében;
--     statisztika, riport, dobás nem hivatkozik rájuk – csak a hibás
--     futás link-sorai;
--   - 78 `hunbasket_player_links` sor (szezon 2025/2026, first_seen és
--     last_seen 2026-04-20): 70 a fenti játékosokra mutat, 8 játékos nélküli,
--     és a kódjuk csak a 2024/2025-ös dobásokban szerepel.
-- Felmérés: 2026-11-08, service role olvasással.
--
-- NEM törlődik (szándékosan):
--   - KOLLÁR Bence (NKA Universitas Pécs) 2025/2026-os sora és a linkje: nincs
--     hivatkozás rá, de a Kosarstat szerint a 2025/2026-os keret tagja volt;
--   - a 2025/2026-os hivatkozás nélküli, 2024/2025-ös pár nélküli játékosok
--     (23 db, a keret-importokból) – nem a hibás futásból valók;
--   - a 2026-04-20-i futás azon link-sorai, amelyek valódi 2025/2026-os
--     játékosra mutatnak (70 db) – azonosításuk helyes.
--
-- Az azonosítók explicit listában vannak (pontosan a felmért sorok). A 2. lépés
-- egyetlen DO blokk: minden sort ellenőriz (szezon, 2024/2025-ös pár, link
-- dátumai), a `players`-re mutató ÖSSZES idegen kulcsot a katalógusból
-- (pg_constraint) dinamikusan végignézi, és bármely eltérésnél kivételt dob –
-- ekkor SEMMI nem törlődik. A játékos-törlés csak akkor fut, ha egyetlen
-- táblában sincs rájuk hivatkozás (így az ON DELETE CASCADE sem tud statisztikát
-- törölni).
--
-- Futtatás (a listák ideiglenes táblákban vannak, amelyek csak az adott
-- futtatásig élnek, ezért a 0. lépés mindig menjen együtt a többivel):
--   a) ELŐNÉZET: a 0. és az 1. lépés kijelölve, együtt futtatva – a várt
--      értékek a lekérdezések fölött;
--   b) TÖRLÉS: a 0., a 2. és a 3. lépés kijelölve, együtt futtatva.
-- Az a) után semmi nem változik; ha bármi eltér a várttól, ne futtasd a b)-t.
--
-- ÁLLAPOT: még NEM futott.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. A TÖRLENDŐ SOROK LISTÁJA (az 1. és a 2. lépés is ezt használja)
-- ---------------------------------------------------------------------
-- A lista két ideiglenes táblába kerül, amelyek csak az adott futtatásig élnek:
-- ezt a lépést minden futtatásnál együtt kell kijelölni a többivel (lásd fent).

DROP TABLE IF EXISTS h22_del_players;
CREATE TEMP TABLE h22_del_players (id uuid PRIMARY KEY, name text NOT NULL);
INSERT INTO h22_del_players (id, name) VALUES
    ('868d500b-608a-42ec-94e5-2874eb00633a'::uuid, 'Fazekas Máté'), -- Alba Fehérvár
    ('6dd3b799-b07b-4283-9f41-55f99c37d605'::uuid, 'Filipovity Markó'), -- Alba Fehérvár
    ('ab17e5fd-e5a1-4643-aab4-ef32717ee3e7'::uuid, 'Krivacevic Markó'), -- Alba Fehérvár
    ('32d92adc-e523-41a8-9c5c-4a9b84aabf34'::uuid, 'Nichols David Christopher'), -- Alba Fehérvár
    ('2279263a-0dd1-4540-84d2-6bea3fdaac9e'::uuid, 'SMITH Andrew'), -- Alba Fehérvár
    ('c0d3465d-458a-4e45-9da8-26498ebe3c0e'::uuid, 'CHANDLER III John Watson'), -- Atomerőmű SE
    ('403fc8e6-a6d5-4860-8e76-9ad2030c38eb'::uuid, 'Dorogi Gergő'), -- Atomerőmű SE
    ('4e74af8d-e3df-44e7-891a-384518fb1e9c'::uuid, 'Dukes Khalil Quinton'), -- Atomerőmű SE
    ('5dae5241-dbc4-46f3-8913-c55bd99a4509'::uuid, 'Joseph Yasiin Yousef'), -- Atomerőmű SE
    ('5d282dcd-bc56-42e5-9d2c-bc497cff14c0'::uuid, 'Kékesi Kolos'), -- Atomerőmű SE
    ('12026ae1-0d07-4e59-8684-ed1dec68eae5'::uuid, 'Kovács Ákos'), -- Atomerőmű SE
    ('1ad4472c-1d98-4b70-a590-73fa3b766b66'::uuid, 'Kucsora Csaba Ákos'), -- Atomerőmű SE
    ('9abd386a-5064-4446-be7a-5c5b48dc12e1'::uuid, 'Lake De''Quon'), -- Atomerőmű SE
    ('bb4f9f5a-c9ff-48ca-b8a6-e010da786e25'::uuid, 'Lockett Eric Javon'), -- Atomerőmű SE
    ('c451ce3f-5135-4ef1-9dd1-1f058ae8eb86'::uuid, 'Oduro Prince Kwabena'), -- Atomerőmű SE
    ('d176d339-18f8-499c-b944-bb94441f645b'::uuid, 'Bajo Darko'), -- Budapesti Honvéd Sportegyesület
    ('bde28c49-a0b6-48d4-b1e7-d3679769b9ea'::uuid, 'Filipovic Stefan'), -- Budapesti Honvéd Sportegyesület
    ('c6ff2106-f7fc-4da8-b981-bf83e3a0e993'::uuid, 'Hajdu Péter Márton'), -- Budapesti Honvéd Sportegyesület
    ('5e10c0ae-f69a-4766-b08d-f868bc83e440'::uuid, 'Hardrict Jr Quentin Kirk'), -- Budapesti Honvéd Sportegyesület
    ('1a301ffb-41fd-4441-ad10-b873af931af9'::uuid, 'Karda Dominik Krisztián'), -- Budapesti Honvéd Sportegyesület
    ('d68b147f-f6be-4adc-b740-3c966f93037c'::uuid, 'Czermann Patrik Ákos'), -- DEAC
    ('1a7e1789-8b3a-4c00-acf2-eb6727ab4466'::uuid, 'Drenovac Dorde'), -- DEAC
    ('0312131f-96ee-4e3d-a035-e61436b14666'::uuid, 'Hegedüs Brúnó'), -- DEAC
    ('ae73de0f-bf99-43a4-8962-091b7f0c1a6e'::uuid, 'Cohill Eric Edward'), -- Délút-SZTE-Szedeák
    ('4206f22b-67a7-431c-9d24-d297fa7131fe'::uuid, 'Davis Deandre Devonte'), -- Délút-SZTE-Szedeák
    ('ca36cddf-ec1c-4f73-b8bf-02f258ad12c7'::uuid, 'Herndon Alan Michael'), -- Délút-SZTE-Szedeák
    ('ace75eea-8f32-46d5-a48a-2b132ed9035d'::uuid, 'Laluska Bence Ádám'), -- Délút-SZTE-Szedeák
    ('0ff6a879-ea5f-4895-b8e4-c133a9894d2e'::uuid, 'Langley Kobe D'), -- Délút-SZTE-Szedeák
    ('974d413b-70df-4d08-afa3-66828a4685ee'::uuid, 'Tate Jaylon Christopher'), -- Délút-SZTE-Szedeák
    ('c3d58e47-a879-4dbf-86b8-1368257a20cd'::uuid, 'Dávid Benjámin'), -- Duna Aszfalt-DTKH Kecskemét
    ('ef914da8-9b3f-47d3-8606-b45aa279f8b4'::uuid, 'Gera Ferenc'), -- Duna Aszfalt-DTKH Kecskemét
    ('0ea12945-4ebe-4cdc-bb21-a6a88a280437'::uuid, 'Sinik Marko'), -- Duna Aszfalt-DTKH Kecskemét
    ('c7a2eff2-469c-4710-8c68-caa5b962c4d6'::uuid, 'Tóth Patrik Kristóf'), -- Duna Aszfalt-DTKH Kecskemét
    ('a88e6b86-10a8-43c5-986f-f602453bccf5'::uuid, 'Boskovic Zdravko'), -- Egis Körmend
    ('fd726759-a2c3-455b-8c91-334c08133062'::uuid, 'Gáspár Mátyás'), -- Egis Körmend
    ('ff9899cf-71f4-41c8-a485-5f688b8b116e'::uuid, 'Geröly Márton András'), -- Egis Körmend
    ('1db1643d-0165-405f-b608-906ecccf0050'::uuid, 'Schmera Gergely'), -- Egis Körmend
    ('94b61296-d50a-4f64-845d-e18cae4abc52'::uuid, 'Williams Reaudale Shamaar'), -- Egis Körmend
    ('7d45c1de-56bc-408d-a179-5adc4d1bec43'::uuid, 'Diggs Trey Erique'), -- Falco KC Szombathely
    ('e1cf697c-086c-4cc9-893c-d15441cad1b0'::uuid, 'Hansen Daniel'), -- Falco KC Szombathely
    ('a7a78be3-b85b-466a-bd25-521fa15da106'::uuid, 'Kovács Benedek Máté'), -- Falco KC Szombathely
    ('bc936e1f-bf44-4a13-829d-760a72b515cc'::uuid, 'Németh Bálint Péter'), -- Falco KC Szombathely
    ('2998f7a5-db9d-4306-a8f9-306db8dd5f29'::uuid, 'Pongó Marcell'), -- Falco KC Szombathely
    ('5a3d58b6-08e8-46c1-bce2-773d2397524b'::uuid, 'Sövegjártó Ábel György'), -- Falco KC Szombathely
    ('efb45162-cab1-4e87-8452-838c710e4e8a'::uuid, 'Tiby Matthew James'), -- Falco KC Szombathely
    ('1e806147-c563-4e71-af13-d183c2da33e3'::uuid, 'Jovanovic Strahinja'), -- NHSZ-Szolnoki Olajbányász
    ('8d9424c6-deab-4cca-98f3-00a395b53652'::uuid, 'Peringer Balázs'), -- NHSZ-Szolnoki Olajbányász
    ('b3d74b68-22af-42d2-a634-68ecd39534c5'::uuid, 'Radovanovic Marko'), -- NHSZ-Szolnoki Olajbányász
    ('5a7810d2-1c5d-4e24-ab17-abc1d206c96d'::uuid, 'Szugyiczki Máté'), -- NHSZ-Szolnoki Olajbányász
    ('d3e1e638-8bb3-46b3-b153-e86baf2747a1'::uuid, 'Bacovic Vasilije'), -- NKA Universitas Pécs
    ('77056a7c-ae5c-4151-ae46-44f13cb5c6ba'::uuid, 'Herger Salamon'), -- NKA Universitas Pécs
    ('9f84cfed-260b-4f6c-9717-ccbe6891ea8c'::uuid, 'Kerpel-Fronius Gáspár'), -- NKA Universitas Pécs
    ('7f7c9af1-ab17-47b1-9654-86bda4fedde6'::uuid, 'Árva-File Balázs'), -- OSE Lions
    ('6a2dfe08-f962-4a86-bb1b-1d3bc1de2ea5'::uuid, 'Burton Jamarius'), -- OSE Lions
    ('209696e4-e08a-4f97-98e9-04346b98c05d'::uuid, 'Carter Jr. Chico Mellichamp'), -- OSE Lions
    ('14bba04a-78c6-4ad7-8ff4-e3ec1853e906'::uuid, 'Czermann Máté'), -- OSE Lions
    ('044ff726-f8d8-4bfa-8471-f9c5fafb4399'::uuid, 'Hill Isaiah Malik'), -- OSE Lions
    ('4ba1379c-a723-490b-9f85-13e01467d299'::uuid, 'Harka Szabolcs'), -- PVSK-VEOLIA
    ('71d6c73d-1c1e-48a6-af3c-a50b8e8c18b6'::uuid, 'Johnson Nigel Armoni'), -- PVSK-VEOLIA
    ('9135cfe1-2cdc-4a53-b1da-27f56dfd36bd'::uuid, 'Micovic Ognjen'), -- PVSK-VEOLIA
    ('c1de7649-2b63-47d9-a46f-ab0305d7f852'::uuid, 'Mokánszki Máté'), -- PVSK-VEOLIA
    ('2645d55b-2a48-4a5a-9718-f1b50d979cff'::uuid, 'Rácz Gábor'), -- PVSK-VEOLIA
    ('69158eba-3ad5-48dd-8d26-2e9cb7687704'::uuid, 'Radó Ádám'), -- PVSK-VEOLIA
    ('69f51d16-a549-409a-a1d2-9b9c9d0f6473'::uuid, 'Ravasz Márk'), -- PVSK-VEOLIA
    ('a64e337c-f774-4da2-9c65-4aba5be49e73'::uuid, 'Fofana Selim Moise'), -- Sopron KC
    ('52772aab-a9e5-4b43-92b8-9e708b8f7a69'::uuid, 'Molnár Márton'), -- Sopron KC
    ('0ef8b70a-8efc-414f-be6a-d79b686d08c8'::uuid, 'Mucius Isaiah Mathieu'), -- Sopron KC
    ('93bd40aa-5b68-4ba4-b041-a120f8bb6728'::uuid, 'Bigelow Isaiah Jewels'), -- Zalakerámia ZTE KK
    ('de10eaef-2f9c-49b0-b3b5-11dda856a966'::uuid, 'Brown Tevin Dejuan'), -- Zalakerámia ZTE KK
    ('570825ca-d56e-401f-9681-d23fa38474b2'::uuid, 'Gyimes Áron'), -- Zalakerámia ZTE KK
    ('e699267e-8656-477f-ac47-378da3176f41'::uuid, 'Jones Aaron Eugene'), -- Zalakerámia ZTE KK
    ('613c0854-4d0d-43f9-8bad-bdf856a5ca0e'::uuid, 'Mészáros Ágoston'), -- Zalakerámia ZTE KK
    ('296082fa-80f8-4aa4-b7b2-02bc657841b8'::uuid, 'Sitku Márton'), -- Zalakerámia ZTE KK
    ('a3fd230e-2925-47ea-b5a7-4d06638a544d'::uuid, 'Takács Martin') -- Zalakerámia ZTE KK
;

DROP TABLE IF EXISTS h22_del_links;
CREATE TEMP TABLE h22_del_links (id uuid PRIMARY KEY);
INSERT INTO h22_del_links (id) VALUES
    ('0036b5ac-d551-4809-9e4c-11bbfbd8d721'::uuid), -- A400524 Johnson Nigel Armoni
    ('04f7dda9-07e6-48c0-81c8-323eb2f8fd2a'::uuid), -- A66425 Fazekas Máté
    ('0539067a-cc0b-45a1-99b4-4e178dcf9173'::uuid), -- A94274 Czermann Patrik Ákos
    ('079a7759-9437-435a-a397-2495d12cea8a'::uuid), -- SPIh-1 REMY Abell
    ('0b18466b-63a4-4090-9eb6-2972f411a892'::uuid), -- A442491 Carter Jr. Chico Mellichamp
    ('0d4152ea-f006-483e-8356-d198f74ebde4'::uuid), -- A403402 Lockett Eric Javon
    ('11184c80-53e2-41bd-a690-7df4d8eb0dc7'::uuid), -- A64486 Bajo Darko
    ('12e31921-4172-4ba4-b623-8e34d11e34bf'::uuid), -- A65345 Peringer Balázs
    ('15625d64-6fc8-49ed-b7a1-4a9542e6e573'::uuid), -- SPIv11 BISHOP James
    ('1682523a-9aa7-40c3-b075-a0171320ea8f'::uuid), -- A780977 Ravasz Márk
    ('16a3ec8f-8d61-4b69-aadf-3bd4e9b61d0d'::uuid), -- SPIv14 KWAME Donte Vaughn
    ('19df3f66-4cc5-4dd0-8d18-cebe771700e4'::uuid), -- A401248 Lake De'Quon
    ('1bf36822-96d9-41a5-9b17-af14956138cf'::uuid), -- SPIv-4 VAUGHN Kwame  Donte
    ('1eadefdf-1faa-45ae-8253-b7c66b69daac'::uuid), -- A820265 Gyimes Áron
    ('232e0e70-aa33-46d1-9818-7cb722fa37f8'::uuid), -- A819456 Hardrict Jr Quentin Kirk
    ('288d3af8-68fa-44ec-9625-8b154465a0d9'::uuid), -- A790357 Laluska Bence Ádám
    ('2be01403-277b-4a91-b2c8-69ed25302002'::uuid), -- A69370 Mokánszki Máté
    ('32340b91-7d3a-4889-b083-0c5f8ca2125c'::uuid), -- A74534 Dorogi Gergő
    ('35cfbe65-74df-4a9c-90d2-a048d9f546d9'::uuid), -- A66374 Herger Salamon
    ('383f0210-6776-4da4-b748-b6d8a08c43fc'::uuid), -- A777201 Hegedüs Brúnó
    ('3bb186e0-5e73-4181-9fd4-a346c29c902a'::uuid), -- A78423 Jovanovic Strahinja
    ('3c62bbb8-8595-4d57-afe1-e53d12c42b92'::uuid), -- A80379 Bacovic Vasilije
    ('4408c218-e0a6-4896-a65d-1730053b8b44'::uuid), -- A56192 Molnár Márton
    ('44eb8d09-0226-46ab-8d70-885f9c34a790'::uuid), -- A402169 Dukes Khalil Quinton
    ('479fe691-89e0-4906-8258-9803f43507c4'::uuid), -- SPIh-1 RADOVANOVIC Marko
    ('4a9427ac-369d-4d74-b77d-06f0b81fc4ec'::uuid), -- A90038 SMITH Andrew
    ('4dfab5f9-3a8b-44f6-81bd-a7ca892bf226'::uuid), -- A779630 Cohill Eric Edward
    ('5687bf84-830e-4900-94fc-271922aa7e9d'::uuid), -- A69373 Sitku Márton
    ('591c88fe-5c02-4d83-ab9f-10577d268431'::uuid), -- A780985 Radó Ádám
    ('59f12236-1880-4a2d-b86f-914eb2d703b8'::uuid), -- A41349 Drenovac Dorde
    ('5a448a28-f22b-4a5d-b71d-d635aa75bcc9'::uuid), -- A441919 Diggs Trey Erique
    ('5b6a9a23-0d85-43ce-9b57-2cb467f42859'::uuid), -- A832004 Rácz Gábor
    ('67f64bf6-6fb8-4e2e-96d3-6c8d687ae7f3'::uuid), -- A779344 Hajdu Péter Márton
    ('682eef61-601a-4409-8e9d-e9084da339ed'::uuid), -- A90685 Tate Jaylon Christopher
    ('683fca4e-104c-46ff-8222-f9d1a47c609f'::uuid), -- A778017 Mészáros Ágoston
    ('69e45d42-b1c2-4375-aa5d-84679dffc1f9'::uuid), -- A92229 Sövegjártó Ábel György
    ('6f6e764e-1368-4a90-a549-9b1615f3a71a'::uuid), -- A61632 Pongó Marcell
    ('6fae33d2-f8f1-4d2d-b539-889b91e80320'::uuid), -- A439218 Burton Jamarius
    ('7101ea9a-56f3-4692-942c-4094624e047b'::uuid), -- A442078 Langley Kobe D
    ('7123ce1d-d442-41e6-81f9-56f171faf6b4'::uuid), -- A64722 Kerpel-Fronius Gáspár
    ('72f463d6-c611-44e8-aa97-be5b08e27f9b'::uuid), -- SPIv-4 JACKSON K.J.
    ('797773c5-53dc-499b-b18a-a67ca69fd23b'::uuid), -- A790488 Geröly Márton András
    ('80849a0b-2ac6-4b15-b293-f479fc17e2bc'::uuid), -- A789450 Kékesi Kolos
    ('8973bb36-0306-4c42-a7aa-4020b0a2cb71'::uuid), -- A64308 Kucsora Csaba Ákos
    ('8aea9fb8-85ec-4ec4-8dbc-f2be212eded8'::uuid), -- A69342 Filipovic Stefan
    ('8f608959-98a6-42f3-8e50-d02a455b3976'::uuid), -- A101760 Jones Aaron Eugene
    ('90b93aa6-326c-485f-946e-53f07c501cf4'::uuid), -- A81482 Boskovic Zdravko
    ('91a9447a-9329-405d-aaa6-40e556e3cc5d'::uuid), -- A790347 Dávid Benjámin
    ('9392e7a9-e57f-4253-8698-48ad95e26f14'::uuid), -- A779499 Szugyiczki Máté
    ('945c2b3a-5977-4104-bf92-c79aa6369e22'::uuid), -- A72777 Gáspár Mátyás
    ('993fe634-5cea-4b24-b2ab-cf651040aa90'::uuid), -- SPIv-4 JONES Aaron Eugene
    ('9b0e8efa-ce71-40d1-8c9d-ea44f597c8ac'::uuid), -- A64119 Krivacevic Markó
    ('a42224c7-f168-40af-8c91-915b565dbdc6'::uuid), -- A402236 Nichols David Christopher
    ('a6dae19f-1b8e-4ad2-9918-49e57b52a37b'::uuid), -- A56076 Filipovity Markó
    ('a9e6ec63-17bd-419f-bf90-7a52402e784f'::uuid), -- A438966 Mucius Isaiah Mathieu
    ('adebb553-5c69-4804-bda8-2fe00315053a'::uuid), -- A790272 Hansen Daniel
    ('af3f5a73-8e75-4175-940f-bf3399e35a51'::uuid), -- SPIh0 JACKSON K.J.
    ('b87767a6-d7bd-48f5-8bdb-f30f5b150dae'::uuid), -- A73439 Kovács Benedek Máté
    ('b8ac515f-7611-48bd-a3f0-a9b8935cd9ed'::uuid), -- A106840 Oduro Prince Kwabena
    ('ba2bd3cb-899d-4ff6-8e38-7541c16f5b59'::uuid), -- A778006 Árva-File Balázs
    ('bccb8605-31d3-4a74-9df9-fdc5cd909be5'::uuid), -- A801568 Németh Bálint Péter
    ('d1318c6c-0d59-4086-adfc-eea68692ebb3'::uuid), -- A767364 Hill Isaiah Malik
    ('d13aeb1b-abeb-4af3-90f1-536c135891cd'::uuid), -- A69757 Tiby Matthew James
    ('dbf51cef-d400-4de3-8eb5-8967dc7d8589'::uuid), -- A442166 Bigelow Isaiah Jewels
    ('dd35d0d1-c6ee-4ca4-9c46-aa53bc8d027c'::uuid), -- A779468 Sinik Marko
    ('dd8e4f9e-2800-458a-98bd-6523e2a411f0'::uuid), -- A308917 Fofana Selim Moise
    ('de4c6153-626b-4b19-8449-97ed227a4d01'::uuid), -- A400646 CHANDLER III John Watson
    ('e1225fc5-395b-4c84-81dc-19c0c40ded85'::uuid), -- A109432 Davis Deandre Devonte
    ('e1d849d9-68a2-4688-9c48-7582be20be3a'::uuid), -- A754899 Micovic Ognjen
    ('e32befbd-ac60-4b5a-be02-bcc869d131cc'::uuid), -- SPIv5 MCGOWENS Trey
    ('ea008d98-4ccc-44a0-9142-02fbf2f1357e'::uuid), -- A773747 Joseph Yasiin Yousef
    ('ee3f3917-2bb2-4a6e-a63c-b378242c13ad'::uuid), -- SPIh-1 ODURO Prince
    ('f1feb2ff-e744-4d67-9291-fd116463e05a'::uuid), -- A67236 Takács Martin
    ('f334ebc8-8e73-46fe-9e38-e896ff587fee'::uuid), -- A440704 Brown Tevin Dejuan
    ('f69af4a2-5fe9-42bb-b57e-d50d374f1df8'::uuid), -- A774977 Williams Reaudale Shamaar
    ('f7513f10-6c31-4b5d-ae18-7655425055d6'::uuid), -- A776186 Schmera Gergely
    ('fb65ebdc-0f2a-4d0d-9bcc-6646c492d981'::uuid), -- A401596 Herndon Alan Michael
    ('fe204964-d393-46a4-a7de-fbe419867c08'::uuid) -- A35370 Kovács Ákos
;

-- ---------------------------------------------------------------------
-- 1. ELŐNÉZET – csak olvas
-- ---------------------------------------------------------------------

-- Egyetlen táblázat: ellenőrzés | érték | várt. Ha bármelyik sorban az érték
-- nem egyezik a várttal, NE futtasd a törlést.
WITH del_p AS (SELECT id, name FROM h22_del_players),
     del_l AS (SELECT id FROM h22_del_links)
SELECT * FROM (VALUES
  ('1/a lista – játékos', (SELECT count(*) FROM del_p), 74),
  ('1/b játékos létezik, 2025/26-os, a név egyezik',
     (SELECT count(*) FROM players p JOIN del_p d ON d.id = p.id AND d.name = p.name
        JOIN seasons s ON s.id = p.season_id AND s.name = '2025/2026'), 74),
  ('1/c játékosnak van 2024/25-ös párja (csapat + név)',
     (SELECT count(*) FROM players p JOIN del_p d ON d.id = p.id
       WHERE EXISTS (SELECT 1 FROM players t JOIN seasons s ON s.id = t.season_id AND s.name = '2024/2025'
                      WHERE t.team_id = p.team_id AND lower(trim(t.name)) = lower(trim(p.name)))), 74),
  ('1/d lista – link', (SELECT count(*) FROM del_l), 78),
  ('1/e link 2025/26-os, a hibás 2026-04-20-i futásból',
     (SELECT count(*) FROM hunbasket_player_links l JOIN del_l d ON d.id = l.id
        JOIN seasons s ON s.id = l.season_id AND s.name = '2025/2026'
       WHERE l.first_seen_at::date = DATE '2026-04-20' AND l.last_seen_at::date = DATE '2026-04-20'), 78),
  ('1/f link törlendő játékosra mutat',
     (SELECT count(*) FROM hunbasket_player_links l JOIN del_l d ON d.id = l.id
       WHERE l.player_id IN (SELECT id FROM del_p)), 70),
  ('1/g link játékos nélkül',
     (SELECT count(*) FROM hunbasket_player_links l JOIN del_l d ON d.id = l.id WHERE l.player_id IS NULL), 8),
  ('1/h törlendő játékosra mutató, NEM törlendő link',
     (SELECT count(*) FROM hunbasket_player_links l
       WHERE l.player_id IN (SELECT id FROM del_p) AND l.id NOT IN (SELECT id FROM del_l)), 0),
  ('1/i hivatkozás: player_game_stats_2024_2025',
     (SELECT count(*) FROM player_game_stats_2024_2025 WHERE player_id IN (SELECT id FROM del_p)), 0),
  ('1/j hivatkozás: player_game_stats_2025_2026',
     (SELECT count(*) FROM player_game_stats_2025_2026 WHERE player_id IN (SELECT id FROM del_p)), 0),
  ('1/k hivatkozás: player_game_stats_2026_2027',
     (SELECT count(*) FROM player_game_stats_2026_2027 WHERE player_id IN (SELECT id FROM del_p)), 0),
  ('1/l hivatkozás: hunbasket_shot_events',
     (SELECT count(*) FROM hunbasket_shot_events WHERE player_id IN (SELECT id FROM del_p)), 0),
  ('1/m hivatkozás: player_text_reports',
     (SELECT count(*) FROM player_text_reports WHERE player_id IN (SELECT id FROM del_p)), 0),
  ('1/n hivatkozás: player_game_text_reports',
     (SELECT count(*) FROM player_game_text_reports WHERE player_id IN (SELECT id FROM del_p)), 0)
) AS t(ellenorzes, ertek, vart);
-- (A 2. lépés a hivatkozásokat a katalógusból MINDEN idegen kulcsra újra ellenőrzi.)

-- ---------------------------------------------------------------------
-- 2. TÖRLÉS – egyetlen tranzakció; bármely eltérésnél semmi nem törlődik
-- ---------------------------------------------------------------------

DO $$
DECLARE
  v_s2425 uuid;
  v_s2526 uuid;
  v_n int;
  v_links_deleted int;
  v_players_deleted int;
  r record;
BEGIN
  SELECT id INTO STRICT v_s2425 FROM seasons WHERE name = '2024/2025';
  SELECT id INTO STRICT v_s2526 FROM seasons WHERE name = '2025/2026';

  -- Játékosok: mind létezik, 2025/2026-os, a név egyezik, és van 2024/2025-ös párja.
  SELECT count(*) INTO v_n
    FROM players p JOIN h22_del_players d ON d.id = p.id AND d.name = p.name
   WHERE p.season_id = v_s2526
     AND EXISTS (SELECT 1 FROM players t
                  WHERE t.season_id = v_s2425 AND t.team_id = p.team_id
                    AND lower(trim(t.name)) = lower(trim(p.name)));
  IF v_n <> 74 OR (SELECT count(*) FROM h22_del_players) <> 74 THEN
    RAISE EXCEPTION 'H22 utómunka: % játékos felel meg a feltételeknek a várt 74 helyett – leállítva', v_n;
  END IF;

  -- Linkek: mind 2025/2026-os, a hibás 2026-04-20-i futásból, és vagy törlendő játékosra mutat, vagy üres.
  SELECT count(*) INTO v_n
    FROM hunbasket_player_links l JOIN h22_del_links d ON d.id = l.id
   WHERE l.season_id = v_s2526
     AND l.first_seen_at::date = DATE '2026-04-20'
     AND l.last_seen_at::date = DATE '2026-04-20'
     AND (l.player_id IS NULL OR l.player_id IN (SELECT id FROM h22_del_players));
  IF v_n <> 78 OR (SELECT count(*) FROM h22_del_links) <> 78 THEN
    RAISE EXCEPTION 'H22 utómunka: % link felel meg a feltételeknek a várt 78 helyett – leállítva', v_n;
  END IF;

  -- 1) Linkek törlése.
  DELETE FROM hunbasket_player_links WHERE id IN (SELECT id FROM h22_del_links);
  GET DIAGNOSTICS v_links_deleted = ROW_COUNT;
  IF v_links_deleted <> 78 THEN
    RAISE EXCEPTION 'H22 utómunka: % link törölve a várt 78 helyett – leállítva', v_links_deleted;
  END IF;

  -- 2) Minden `players`-re mutató idegen kulcs ellenőrzése a katalógusból:
  --    a törlendő játékosokra sehol nem maradhat hivatkozás.
  FOR r IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f'
       AND c.confrelid = 'public.players'::regclass
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I IN (SELECT id FROM h22_del_players)', r.tbl, r.col) INTO v_n;
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'H22 utómunka: %.% még % sorral hivatkozik a törlendő játékosokra – leállítva', r.tbl, r.col, v_n;
    END IF;
  END LOOP;

  -- 3) Játékosok törlése.
  DELETE FROM players WHERE id IN (SELECT id FROM h22_del_players) AND season_id = v_s2526;
  GET DIAGNOSTICS v_players_deleted = ROW_COUNT;
  IF v_players_deleted <> 74 THEN
    RAISE EXCEPTION 'H22 utómunka: % játékos törölve a várt 74 helyett – leállítva', v_players_deleted;
  END IF;

  RAISE NOTICE 'H22 utómunka kész: % link és % játékos-sor törölve.', v_links_deleted, v_players_deleted;
END $$;

-- ---------------------------------------------------------------------
-- 3. ELLENŐRZÉS – csak olvas
-- ---------------------------------------------------------------------

-- Egyetlen táblázat: ellenőrzés | érték | várt.
SELECT * FROM (VALUES
  ('3/a maradt listás játékos', (SELECT count(*) FROM players WHERE id IN (SELECT id FROM h22_del_players)), 0),
  ('3/b maradt listás link', (SELECT count(*) FROM hunbasket_player_links WHERE id IN (SELECT id FROM h22_del_links)), 0),
  ('3/c players 2025/26 (előtte 399)',
     (SELECT count(*) FROM players p JOIN seasons s ON s.id = p.season_id WHERE s.name = '2025/2026'), 325),
  ('3/d hunbasket_player_links 2025/26 (előtte 385)',
     (SELECT count(*) FROM hunbasket_player_links l JOIN seasons s ON s.id = l.season_id WHERE s.name = '2025/2026'), 307),
  ('3/e player_game_stats_2024_2025 (érintetlen)', (SELECT count(*) FROM player_game_stats_2024_2025), 3746),
  ('3/f player_game_stats_2025_2026 (érintetlen)', (SELECT count(*) FROM player_game_stats_2025_2026), 4456)
) AS t(ellenorzes, ertek, vart);

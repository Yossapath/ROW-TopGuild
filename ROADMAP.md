<USER_REQUEST>
# ROW-TopGuild — PRODUCTION HARDENING ROADMAP
# สำหรับ AI Coding Agent
# ============================================================
#
# วิธีใช้งาน:
# - ห้ามทำทุก STEP พร้อมกัน
# - User จะเป็นคนสั่งทีละ STEP เช่น:
#     "ทำ STEP 1"
# - เมื่อทำ STEP ที่ถูกสั่งเสร็จแล้ว:
#     1. ตรวจสอบโค้ด
#     2. รัน test
#     3. รัน typecheck
#     4. รัน lint
#     5. รัน build
#     6. รายงานไฟล์ที่เปลี่ยน
#     7. รายงานสิ่งที่แก้
#     8. รายงานผล test/typecheck/lint/build
#     9. หยุดทันที
#
# ห้ามทำ STEP ถัดไปเอง
# ห้ามแก้ปัญหาอื่นที่อยู่นอก STEP ปัจจุบัน
# ============================================================


============================================================
GLOBAL RULES — กฎที่ต้องใช้กับทุก STEP
============================================================

1. อ่านโค้ดจริงใน repository ก่อนแก้ทุกครั้ง
2. ห้ามเดาโครงสร้างจาก roadmap
3. Source of Truth คือ code ปัจจุบันใน repository
4. ตรวจ caller / API / Firestore collection / type / validation
   ที่เกี่ยวข้องก่อนเปลี่ยนโค้ด
5. ห้ามเปลี่ยน Business Logic เดิมโดยไม่จำเป็น
6. ห้ามเปลี่ยน UI เดิมโดยไม่เกี่ยวกับ STEP
7. ห้าม refactor ใหญ่เพียงเพราะคิดว่าสวยกว่า
8. ห้ามเปลี่ยน Firebase schema ถ้า STEP นั้นไม่ได้ระบุ
9. ห้ามเปลี่ยน Queue Logic ของ Dungeon
10. ห้ามเปลี่ยนกฎ Priest / Carry / Round / Team
11. ห้ามสร้างระบบใหม่ซ้ำกับระบบที่มีอยู่แล้ว
12. ถ้าพบปัญหาอื่นระหว่างทำ:
      - ห้ามแก้เอง
      - รายงานไว้ใน "พบปัญหาเพิ่มเติม"
      - รอ User สั่ง
13. ต้องรักษา backward compatibility ถ้าเป็นไปได้
14. ทุก mutation ที่เกี่ยวกับข้อมูลสำคัญต้องคิดเรื่อง concurrency
15. ต้องป้องกันข้อมูลของ Admin คนหนึ่งถูก Admin อีกคนเขียนทับ
16. ต้องป้องกันข้อมูลหายจาก stale frontend state
17. ต้องตรวจ authorization ทุก API ที่แตะข้อมูลสำคัญ
18. ห้ามเพิ่ม Firestore Reads/Writes โดยไม่จำเป็น
19. ห้ามเพิ่ม polling/timer โดยไม่จำเป็น
20. ห้ามลบไฟล์หรือ API ถ้ายังไม่ได้ตรวจ reference ทั้ง repository
21. ก่อนแก้ทุกครั้งให้บอก:
      - ปัญหาที่พบ
      - root cause
      - ไฟล์ที่จะเปลี่ยน
      - วิธีแก้
22. จากนั้นค่อยลงมือแก้
23. หลังแก้ต้องตรวจ regression
24. ถ้า test เดิม fail เพราะการเปลี่ยนแปลง:
      - วิเคราะห์ก่อน
      - แก้เฉพาะสิ่งที่เกี่ยวข้อง
25. ห้ามปิด/ข้าม test เพื่อให้ผ่าน
26. ห้ามใช้ `any` เพื่อหลบ TypeScript error
27. ห้ามใช้ `@ts-ignore` เพื่อหลบ error
28. ห้ามลบ validation เพื่อให้ request ผ่าน
29. ห้ามลด security เพื่อแก้ปัญหา UX
30. ห้ามบอกว่า "production ready" ถ้ายังมี Critical/High issue
31. ห้าม commit/push โดยอัตโนมัติ เว้นแต่ User สั่ง
32. เมื่อ STEP เสร็จ ให้ STOP และรอ User


============================================================
สถานะที่ถือว่าทำไปแล้ว
============================================================

งานก่อนหน้านี้มีการแก้ไขหลายส่วนแล้ว เช่น:

- JWT production secret hardening
- Dungeon queue server-side cache
- Dungeon quota debounce
- Attendance date/range query
- Attendance cache
- Queue/team state synchronization บางส่วน
- isBookingOpen รองรับช่วงเวลาข้ามคืน
- loading state บางส่วน
- responsive cleanup
- dead code บางส่วน

แต่ห้ามเชื่อว่า "เอกสารบอกว่าแก้แล้ว = code แก้แล้ว"

ทุก STEP ต้องตรวจ code จริงอีกครั้ง

โดยเฉพาะ:
- auth
- leave → teams
- attendance
- teams
- roster

ต้องตรวจจาก repository จริง


============================================================
STEP 1 — GVG TEAMS CONCURRENCY / LOST UPDATE
============================================================

เป้าหมาย:
ป้องกัน Admin 2 คนเปิดหน้า GVG Teams พร้อมกัน
แล้ว Admin คนหนึ่งเขียนทับข้อมูลของอีกคนโดยไม่รู้ตัว

ไฟล์หลักที่ต้องตรวจ:

- app/dashboard/teams/page.tsx
- app/api/teams/route.ts

ก่อนแก้:
1. อ่าน frontend state management
2. อ่าน auto-save/debounce
3. อ่าน PUT payload
4. อ่าน Firestore teams document
5. ตรวจว่ามี version/updatedAt อยู่แล้วหรือไม่
6. ตรวจทุก caller ของ /api/teams
7. ตรวจว่ามี endpoint อื่นเขียน teams document หรือไม่

ปัญหาที่ต้องแก้:

ปัจจุบันมีความเสี่ยงลักษณะ:

Admin A โหลด Teams version 1
Admin B โหลด Teams version 1

Admin A แก้ Team 1
Admin B แก้ Team 2

Admin A save
Admin B save ด้วย snapshot เก่า

ผล:
การแก้ของ Admin A อาจหาย

ห้ามแก้ด้วยการบอกว่า:
"Admin อย่าเปิดพร้อมกัน"

ต้องแก้ในระบบจริง

แนวทางที่ต้องพิจารณา:

- optimistic concurrency control
- version
- updatedAt
- Firestore transaction
- conflict detection
- HTTP 409 Conflict

ต้องเลือกวิธีที่เข้ากับ architecture ปัจจุบันที่สุด

ข้อกำหนด:

1. ถ้า frontend state เก่า:
   ห้ามเขียนทับข้อมูลใหม่
2. ต้องตรวจ conflict ก่อน save
3. ถ้าเกิด conflict ต้องไม่ overwrite เงียบ ๆ
4. UI ต้องแจ้ง Admin อย่างเข้าใจง่าย
5. ต้องไม่ทำให้ข้อมูลเดิมหาย
6. ต้องไม่ทำลาย drag/drop
7. ต้องไม่ทำลาย auto-save ถ้ายังจำเป็น
8. ห้ามเปลี่ยน Business Logic การจัดทีม
9. ห้ามเปลี่ยน Team structure
10. ห้ามเปลี่ยน Priest distribution logic

หลังแก้:
- ทดสอบ Admin A / Admin B scenario
- test conflict
- test normal save
- test auto-save
- test refresh
- test existing team data

แล้วรัน:

npm run test
npm run typecheck
npm run lint
npm run build

รายงาน:
- files changed
- root cause
- solution
- concurrency behavior
- tests
- typecheck
- lint
- build

STOP.


============================================================
STEP 2 — LEAVE ↔ GVG TEAMS CONCURRENCY
============================================================

เป้าหมาย:
สมาชิกกด Leave ในขณะที่ Admin กำลังจัด GVG Teams
ต้องไม่ทำให้ข้อมูล Admin หาย

ไฟล์หลัก:

- app/api/leave/route.ts
- ไฟล์ helper transaction ที่เกี่ยวข้อง
- app/api/teams/route.ts ถ้าจำเป็น

ตรวจ flow:

POST /api/leave
      ↓
remove player from GVG
      ↓
write teams

ต้องหา read → modify → set ที่ไม่ได้ใช้ transaction

แก้ให้ใช้ Firestore transaction / OCC
ตาม architecture ที่มีอยู่

ข้อกำหนด:

- ต้องอ่าน Teams ล่าสุดภายใน transaction
- เอาเฉพาะสมาชิกที่ลาออกออก
- รักษา:
    zones
    members
    offlineIds
    orders
    slots
    settings
    players คนอื่น
- ห้าม reset Teams ทั้ง document จาก stale snapshot
- ถ้า Admin save พร้อมกันต้องไม่เกิด lost update
- ถ้าสมาชิกไม่ได้อยู่ในทีม ไม่ควรเขียน Firestore โดยไม่จำเป็น

ต้องทดสอบ:

Scenario A:
Admin save → Leave

Scenario B:
Leave → Admin save

Scenario C:
Admin save + Leave พร้อมกัน

Scenario D:
หลายคน Leave พร้อมกัน

รัน test/typecheck/lint/build

STOP.


============================================================
STEP 3 — ATTENDANCE SILENT DELETION
============================================================

ไฟล์หลัก:

- app/api/attendance/route.ts
- app/dashboard/attendance/page.tsx
- validation ที่เกี่ยวข้อง

ปัญหา:

ถ้า frontend ส่ง:

status = null

ต้องตรวจว่าในระบบปัจจุบัน null หมายถึงอะไร

เป้าหมาย Production:

null ไม่ควรแปลว่า "ลบข้อมูลเดิม"
ถ้าเป็นเพียง "ไม่ได้แก้ไข"

ต้องป้องกัน:

Admin A:
Player A = มา

Admin B:
เปิดหน้าเก่า
แก้ Player B

Admin B save

ผลต้องเป็น:

Player A = มา
Player B = ...

ห้ามเป็น:

Player A = ถูกลบ

แนวทาง:
- submit เฉพาะ changed records
หรือ
- null = no-op
หรือ
- ใช้ explicit reset action

เลือกวิธีที่เหมาะกับ architecture ปัจจุบันที่สุด

ถ้ามีปุ่ม/flow Reset Attendance:
ต้องยังสามารถ reset ได้อย่างชัดเจน

ห้ามทำให้ Admin ไม่สามารถแก้สถานะได้

ต้องทดสอบ concurrent attendance editing

รัน test/typecheck/lint/build

STOP.


============================================================
STEP 4 — ROSTER CONCURRENT EDITING
============================================================

ไฟล์:

- app/dashboard/roster/page.tsx
- app/api/roster/route.ts
- app/api/roster/member/route.ts

ตรวจ:

- Add
- Edit
- Delete

ปัญหาที่ต้องระวัง:

Frontend โหลด roster ทั้งก้อน
→ modify local array
→ PUT roster ทั้งก้อน

ถ้า Admin 2 คนแก้พร้อมกัน
คนหนึ่งอาจเขียนทับอีกคน

เป้าหมาย:

การแก้ Player A
ไม่ควรทำให้ Player B ที่ Admin อีกคนเพิ่งแก้หาย

พยายามใช้:
- targeted update
- transaction
- field update
- operation-based mutation

ตาม architecture จริง

ต้องตรวจว่าการแก้ profile ของสมาชิกที่ใช้ transaction อยู่แล้ว
ยังทำงานถูกต้อง

ห้ามรื้อระบบ Roster ทั้งหมด

ทดสอบ:

- Add concurrent
- Delete concurrent
- Edit concurrent
- Add + Edit
- Delete + Edit

รัน test/typecheck/lint/build

STOP.


============================================================
STEP 5 — DUNGEON PARENT QUEUE STATE CONSISTENCY
============================================================

สำคัญ:
ห้ามเปลี่ยน Dungeon Business Logic

ตรวจ:

- lib/dungeon/queue-transactions.ts
- app/api/dungeon/...
- booking page
- team action routes

ตรวจทุก mutation:

- Auto Assign
- Manual Assign
- Eject
- Complete
- Stop
- Skip
- Cancel
- Team assignment

ต้องแน่ใจว่า Parent Queue State
และ Team State ไม่ขัดกัน

ตัวอย่างที่ห้ามเกิด:

Team = active
Queue = waiting

หรือ

Team = completed
Queue = active

ต้องทำให้ state transition atomic
เมื่อจำเป็น

ห้ามสร้าง Queue Engine ใหม่

ห้ามเปลี่ยน:
- Priest rules
- Carry rules
- Round rules
- team capacity
- booking rules

ทดสอบทุก transition

รัน test/typecheck/lint/build

STOP.


============================================================
STEP 6 — BLOCK INVALID ACTIVE QUEUE DELETE
============================================================

ตรวจ:

app/api/dungeon/queues/[id]/route.ts

เป้าหมาย:

ถ้าผู้เล่นถูก assign เข้า Team แล้ว
ไม่ควรสามารถลบ queue แบบปกติจน state พัง

กำหนดตาม Business Logic เดิม:

waiting
→ cancel ได้ตามเดิม

active/assigned
→ ต้องผ่าน flow ที่ถูกต้อง

Admin:
→ สามารถจัดการผ่าน Eject / existing admin flow

ห้ามเปลี่ยน behavior ของ Booking โดยไม่จำเป็น

ตรวจ:
- authorization
- ownership
- team membership
- queue status

ต้อง return error ที่ frontend จัดการได้
ไม่ใช่ generic 500

ทดสอบ:

- member cancel waiting
- member cancel active
- admin action
- invalid queue id
- unauthorized user

รัน test/typecheck/lint/build

STOP.


============================================================
STEP 7 — SKIP TIMESTAMP / BOOKING DATE INTEGRITY
============================================================

ตรวจ:

- lib/dungeon/booking-rules.ts
- app/api/dungeon/queues/...
- queue transaction
- ทุกจุดที่ใช้ timestamp

ปัญหา:

timestamp เดียวอาจถูกใช้ทั้ง:
- booking date
- FIFO
- queue ordering
- quota

ถ้า Skip เปลี่ยน timestamp
อาจทำให้ booking date เปลี่ยน

ผลกระทบ:
- daily quota
- weekly quota
- 30-person cap
- FIFO

ต้อง audit ทุก usage ก่อนแก้

ถ้าจำเป็นให้แยก:

bookedAt = วันที่จองจริง / immutable

queuedAt = ลำดับการเข้า queue ปัจจุบัน

แต่ต้องรักษา backward compatibility

ห้ามเปลี่ยน Queue Logic โดยไม่ตรวจผลกระทบ

ทดสอบ:
- normal booking
- skip
- skip หลังเที่ยงคืน
- FIFO
- daily quota
- weekly quota
- 30-person cap

รัน test/typecheck/lint/build

STOP.


============================================================
STEP 8 — API AUTHORIZATION AUDIT
============================================================

ตรวจทุก Route Handler

โดยเฉพาะ:

- GET /api/dungeon/queue-items
- GET /api/dungeon/teams
- GET /api/dungeon/queues?type=all
- /api/users
- /api/roster
- /api/attendance
- /api/leave
- /api/logs
- /api/teams
- /api/dungeon/*

แบ่งสิทธิ์:

PUBLIC
MEMBER
ADMIN
OWNER

ห้ามเพิ่ม auth แบบสุ่ม

ก่อนแก้:
- search callers
- ตรวจว่า booking/dashboard ใช้ endpoint ไหน
- ตรวจ middleware
- ตรวจ requireAuth / requireAdmin / requireOwner

เป้าหมาย:
Sensitive API ต้องไม่เปิดข้อมูลให้ unauthenticated user

แต่ห้ามทำให้หน้า /booking หรือหน้า member ที่ควรใช้งานได้พัง

ทดสอบ:
- unauthenticated
- member
- admin
- owner

ทดสอบ status:
401
403
200

รัน test/typecheck/lint/build

STOP.


============================================================
STEP 9 — ADMIN / OWNER PRIVILEGE HIERARCHY
============================================================

ไฟล์หลัก:

- app/api/users/route.ts
- lib/auth.ts
- authorization helpers

กำหนด hierarchy:

OWNER
  ↓
ADMIN
  ↓
MEMBER

ตรวจว่า Admin สามารถ:
- สร้าง owner?
- แก้ owner?
- ลด owner?
- ลบ owner?
- แก้ admin?

หรือไม่

เป้าหมาย:

Admin ไม่สามารถยกระดับตัวเองหรือ user คนอื่นเป็น Owner

Owner เท่านั้นที่สามารถจัดการ Owner privilege

ห้ามทำให้ owner account ล็อกตัวเองโดยไม่ตั้งใจ

ต้องป้องกัน:
- self privilege escalation
- admin → owner
- member → owner
- unauthorized role mutation

ทดสอบ role matrix

รัน test/typecheck/lint/build

STOP.


============================================================
STEP 10 — DUNGEON QUOTA IDOR
============================================================

ตรวจ:

app/api/dungeon/quota/...
lib/dungeon/booking-rules.ts

เป้าหมาย:

Member ต้องดู quota ของตัวเอง

Member ห้าม query quota ของ:
Player A
Player B
Player C

โดยส่ง targetName ของคนอื่น

ถ้า user ไม่มี gameUsername:
ต้องไม่เปิดช่องให้ query คนอื่น

Admin/Owner:
สามารถทำสิ่งที่ Business Logic อนุญาต

ตรวจ:
- authentication
- ownership
- targetName
- role

ทดสอบ IDOR

รัน test/typecheck/lint/build

STOP.


============================================================
STEP 11 — LOG API SECURITY
============================================================

ตรวจ:

app/api/logs/route.ts

เป้าหมาย:

ไม่ควรเชื่อ audit log ที่ client ส่งมาเองแบบไม่มี validation

ตรวจว่ามี business action ไหนเรียก POST /api/logs

พิจารณา architecture:

Business Action
    ↓
Server
    ↓
server-side logAction()
    ↓
Firestore

ถ้า endpoint ยังจำเป็น:
- require authorization
- validate schema
- จำกัด action ที่อนุญาต
- rate limit ถ้าจำเป็น

ห้ามเปิดช่องให้ user ปลอม:
- actor
- role
- action
- target
- timestamp

ห้ามทำให้ Audit Log หาย

รัน test/typecheck/lint/build

STOP.


============================================================
STEP 12 — JWT SESSION / ROLE REVOCATION
============================================================

ตรวจ:

- lib/auth.ts
- middleware.ts
- app/api/auth/*
- login/callback
- JWT creation
- JWT verification

เป้าหมาย:

ถ้า user จาก:

ADMIN
↓
MEMBER

token เก่าไม่ควรใช้สิทธิ์ Admin ได้เป็นเวลานานเกินไป

พิจารณา:
- tokenVersion
- revokedAt
- shorter expiration

เลือกวิธีที่เข้ากับ architecture

ต้องตรวจ:
- Discord login
- existing login
- cookie
- middleware
- API auth
- profile completion

ห้ามทำให้ login loop

ห้ามทำให้ user ที่ login อยู่หลุดโดยไม่จำเป็น

ตรวจ JWT_SECRET:
- production ต้องไม่มี insecure fallback
- development behavior ต้องยังใช้งานได้อย่างปลอดภัย

ห้าม hardcode production secret

ทดสอบ auth flow

รัน test/typecheck/lint/build

STOP.


============================================================
STEP 13 — ROSTER FIREBASE WRITE OPTIMIZATION
============================================================

ทำหลัง STEP 4 เท่านั้น

เป้าหมาย:
ลดการเขียน Roster ทั้ง document

จาก:

แก้ Player A
→ write roster ทั้งก้อน

ไปสู่:

แก้ Player A
→ write เฉพาะข้อมูลที่จำเป็น

ต้องวัด:
- Reads
- Writes
- document size
- concurrent behavior

ห้ามทำ Optimization
จน Concurrency ถูกต้องก่อน

ห้ามแลกความถูกต้องกับ cost

รัน test/typecheck/lint/build

STOP.


============================================================
STEP 14 — ATTENDANCE FIREBASE COST AUDIT
============================================================

ของ Attendance มีการทำ:
- date query
- range query
- cache
- week-based fetching

แต่ห้าม assume ว่าทุกอย่างถูกต้อง

ตรวจ code จริง

เป้าหมาย:
เปิด Attendance ไม่ควรอ่านข้อมูลย้อนหลังจำนวนมากโดยไม่จำเป็น

ตรวจ:
- current date
- selected week
- history
- save
- refresh
- cache invalidation

ต้องไม่ทำให้ข้อมูลประวัติหาย

วัด reads ก่อน/หลังถ้าเป็นไปได้

รัน test/typecheck/lint/build

STOP.


============================================================
STEP 15 — FIREBASE FULL READ/WRITE AUDIT
============================================================

ตรวจทั้งระบบ:

/api/auth/*
/api/users
/api/roster
/api/attendance
/api/leave
/api/logs
/api/teams
/api/dungeon/*

สร้างตาราง:

Route
Method
Auth
Firestore Reads
Firestore Writes
Cache
Potential Cost
Potential Race Condition

หาจุด:
- get() โดยไม่จำเป็น
- อ่านทั้ง document
- read-modify-write
- polling
- duplicate query
- repeated query
- unnecessary writes

ห้ามแก้ทั้งหมดใน STEP นี้

STEP นี้เป็น Audit ก่อน

รายงาน:
Critical
High
Medium
Low

แล้ว STOP


============================================================
STEP 16 — POLLING / CACHE AUDIT
============================================================

ตรวจ:

/booking
/dashboard/dungeon
/dashboard/attendance
/dashboard/teams
/dashboard/users
/dashboard/roster

เป้าหมาย:

ข้อมูลสดพอใช้งาน
แต่ Firebase ไม่โดนยิงเกินจำเป็น

ตรวจ:
- polling interval
- React Query refetch
- cache
- invalidation
- duplicate requests
- request on mount

Dungeon queue cache ที่มีอยู่แล้ว:
ห้ามรื้อถ้าไม่จำเป็น

ห้ามเพิ่ม realtime listener เพียงเพราะคิดว่า realtime ดีกว่า
ต้องคำนึงถึง Firebase cost

รัน test/typecheck/lint/build

STOP.


============================================================
STEP 17 — BOOKING PAGE FINAL UX CLEANUP
============================================================

สำคัญ:
Logic Dungeon เดิมต้องคงไว้

หน้า /booking ต้องใช้ UI เดิมเป็นหลัก
ไม่ต้องออกแบบหน้าใหม่

ต้องลบเฉพาะข้อมูลที่ผู้ใช้ไม่จำเป็นต้องเห็น

คง:
- ฟอร์มจอง
- ชื่อตัวละคร
- Class
- รอบ
- ปุ่มจอง
- Queue list
- Join Team
- Done
- UI structure เดิม
- สี/spacing/card เดิม

Queue List:

แสดงเลขนำหน้า:

1. Player A
2. Player B
3. Player C
4. Yossapath
5. Player D

ถ้า Login user คือ Yossapath:

ต้อง Highlight แถวของ Yossapath

ไม่ต้องเพิ่ม:

- "ถึงคิวแล้ว"
- "อีกกี่คิว"
- ETA
- เวลารอ
- Estimated Start Time
- Queue Estimate
- countdown
- assigned round prediction
- assigned team prediction
- Quick Check selector
- ระบบคำนวณใหม่

หลักการ:

เลขหน้าชื่อ = ผู้ใช้ดูเองได้ว่าตัวเองอยู่ลำดับไหน

ไม่ต้องสร้าง queuePosition engine ใหม่

ไม่ต้องเปลี่ยน backend Queue Logic

ไม่ต้องเปลี่ยน:
- Priest rules
- Carry rules
- Round rules
- Team assignment
- Admin actions

นี่เป็น UI cleanup เท่านั้น

รัน test/typecheck/lint/build

STOP.


============================================================
STEP 18 — RESPONSIVE / MAIN PAGE UX AUDIT
============================================================

ตรวจหน้าใช้งานหลักทั้งหมด:

- login
- profile completion
- booking
- dashboard
- dungeon
- teams
- attendance
- roster
- users
- leave
- logs

เป้าหมาย:

Production UX:
- ไม่มี layout พัง
- ไม่มี overflow ที่ไม่จำเป็น
- mobile ใช้งานได้
- desktop ใช้งานได้
- modal/dropdown ไม่เพี้ยน
- loading state
- empty state
- error state
- permission denied state

ห้าม redesign

แก้เฉพาะ bug ที่พบ

ตรวจว่าไม่ใช้ CSS hack ที่ไม่จำเป็น

รัน test/typecheck/lint/build

STOP.


============================================================
STEP 19 — ERROR HANDLING / API ROBUSTNESS
============================================================

ตรวจ API หลักทั้งหมด

ต้องไม่มี:

catch แล้วเงียบ
console.error อย่างเดียว
return 500 ทุกกรณี
frontend ไม่รู้ว่าเกิดอะไรขึ้น

แยก:

400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
429 Too Many Requests
500 Internal Server Error

ตามความเหมาะสม

Frontend ต้อง handle error สำคัญ

ห้ามเปิดข้อมูล internal error ให้ user

ห้าม swallow exception

ห้ามแก้โดยใช้ generic "try/catch แล้ว return success"

รัน test/typecheck/lint/build

STOP.


============================================================
STEP 20 — VALIDATION / EDGE CASE AUDIT
============================================================

ตรวจ validation:

- username
- email
- gameUsername
- class
- power
- queue
- rounds
- attendance
- leave
- teams
- users
- logs

ทดสอบ:
- empty string
- whitespace
- null
- undefined
- negative
- huge number
- duplicate
- invalid enum
- malformed ID
- malformed date
- malformed timestamp

ห้ามเพิ่ม max/min โดยเดาตัวเลข Game จริง

ถ้าจะกำหนด game-specific limit
ต้องมีหลักฐานจาก Business Logic หรือ config

รัน test/typecheck/lint/build

STOP.


============================================================
STEP 21 — DEAD CODE / OLD ROUTE AUDIT
============================================================

ตรวจ:

- fix.js
- debug endpoint
- old team route
- duplicate helper
- unused API
- unused component
- unused import

ห้ามลบก่อน:
1. search repository
2. search API caller
3. search frontend caller
4. search tests
5. search scripts
6. search documentation/config

ถ้าไม่มี reference จริง:
ค่อยเสนอให้ลบ

ถ้ามีความเสี่ยง:
อย่าลบ

ห้ามลบใน STEP นี้จนกว่าจะพิสูจน์ว่า safe

รัน test/typecheck/lint/build

STOP.


============================================================
STEP 22 — TEST QUALITY / REAL PRODUCTION CODE
============================================================

ตรวจ tests ทั้งหมด

เป้าหมาย:
Test ต้องทดสอบ production code จริง

ไม่ใช่:

mock function ของ production
แล้วทดสอบ mock

ต้องเพิ่ม regression tests สำหรับ Critical logic:

1. Teams concurrency
2. Attendance concurrent save
3. Leave + Teams
4. Queue state consistency
5. Queue delete protection
6. Skip timestamp
7. Auth
8. Authorization
9. Owner hierarchy
10. Quota IDOR
11. validation
12. booking rules

ต้องไม่ลดจำนวน test เพื่อให้ผ่าน

รัน:

npm run test
npm run typecheck
npm run lint
npm run build

STOP.


============================================================
STEP 23 — FULL SECURITY AUDIT
============================================================

ตรวจ:

Authentication
Authorization
IDOR
Privilege Escalation
CSRF considerations
JWT
Cookies
Input Validation
Rate Limiting
Audit Logs
Sensitive API
Admin endpoints
Owner endpoints

สร้าง Security Matrix:

Endpoint
Public?
Auth?
Member?
Admin?
Owner?
IDOR risk?
Mutation?
Validation?

เป้าหมาย:

ไม่มี Critical security issue
ไม่มี High security issue

ห้ามแก้ Business Logic ที่ไม่เกี่ยว

รัน test/typecheck/lint/build

STOP.


============================================================
STEP 24 — FULL FIREBASE COST AUDIT
============================================================

ตรวจ Firebase usage จริง

แยก:

READ
WRITE
DELETE
QUERY
CACHE
POLLING

โดยเฉพาะ:

- Booking
- Dungeon dashboard
- Teams
- Attendance
- Roster
- Users
- Logs
- Leave

ห้าม optimize ด้วยการทำข้อมูล stale จนระบบใช้งานไม่ได้

เป้าหมาย:

"Cost-efficient แต่ข้อมูลถูกต้อง"

รายงาน:
- จุดที่แพง
- ทำไมแพง
- estimated frequency
- proposed fix
- risk
- expected saving

STEP นี้เป็น Audit ก่อน
ห้ามแก้ทุกอย่างพร้อมกัน

STOP.


============================================================
STEP 25 — FINAL REGRESSION
============================================================

ทดสอบ User Flow จริงตั้งแต่ต้นจนจบ

USER FLOW:

1. Discord Login
2. Profile incomplete
3. Complete Profile
4. เข้า Dashboard
5. เข้า Booking
6. จอง Dungeon
7. ดู Queue
8. User ตัวเองถูก Highlight
9. Join Team
10. Done
11. Leave
12. Attendance
13. View history

ADMIN FLOW:

1. Login
2. Users
3. Roster
4. Attendance
5. Leave
6. Dungeon
7. Queue management
8. Teams
9. Logs
10. Schedule

CONCURRENT ADMIN FLOW:

Admin A + Admin B

1. Teams พร้อมกัน
2. Attendance พร้อมกัน
3. Roster พร้อมกัน
4. Leave + Teams พร้อมกัน

ตรวจว่า:
- ไม่มีข้อมูลหาย
- ไม่มี stale overwrite
- ไม่มี duplicate
- ไม่มี unauthorized access
- ไม่มี broken UI

รัน:

npm run test
npm run typecheck
npm run lint
npm run build

STOP.


============================================================
STEP 26 — PRODUCTION READINESS FINAL AUDIT
============================================================

ห้ามแก้ code ก่อน

ตรวจทั้งหมด

สร้างรายงาน:

SECURITY
- Critical
- High
- Medium
- Low

DATA INTEGRITY
- Lost Update
- Silent Delete
- Race Condition
- Duplicate
- State inconsistency

PERFORMANCE
- Reads
- Writes
- Queries
- Polling
- Cache

UX
- Main pages
- Loading
- Error
- Empty state
- Responsive

TEST
- Unit
- Regression
- Integration ถ้ามี

BUILD
- TypeScript
- Lint
- Production Build

PRODUCTION CONFIG
- Environment variables
- JWT_SECRET
- Firebase credentials
- Discord credentials
- Admin configuration

ห้ามบอก "Production Ready"
จนกว่าจะตรวจครบ


============================================================
FINAL PRODUCTION GATE
============================================================

ถือว่า Production Ready ได้ก็ต่อเมื่อ:

[ ] Critical bugs = 0
[ ] High bugs = 0
[ ] Lost Update ที่รู้จัก = 0
[ ] Silent data deletion ที่รู้จัก = 0
[ ] Sensitive API ไม่มี unauthenticated access
[ ] IDOR ที่รู้จัก = 0
[ ] Privilege escalation ที่รู้จัก = 0
[ ] Admin concurrency ผ่าน
[ ] Attendance concurrency ผ่าน
[ ] Roster concurrency ผ่าน
[ ] Leave + Teams concurrency ผ่าน
[ ] Dungeon state consistency ผ่าน
[ ] Queue delete protection ผ่าน
[ ] Booking Logic เดิมยังทำงาน
[ ] Priest Logic เดิมยังทำงาน
[ ] Team Logic เดิมยังทำงาน
[ ] Round Logic เดิมยังทำงาน
[ ] Firebase reads/writes อยู่ในระดับที่รับได้
[ ] ไม่มี polling ที่ไม่จำเป็น
[ ] Error handling ครบ
[ ] Validation ครบ
[ ] Tests ผ่าน
[ ] Typecheck ผ่าน
[ ] Lint ผ่าน
[ ] Production Build ผ่าน


============================================================
IMPORTANT — วิธีที่ USER จะสั่งงาน
============================================================

ห้าม AI Agent เริ่มทำ STEP เอง

User จะสั่ง:

"ทำ STEP 1"

เมื่อ STEP 1 เสร็จ:
- รายงาน
- test
- typecheck
- lint
- build
- STOP

จากนั้น User จะสั่ง:

"ทำ STEP 2"

และทำแบบนี้ไปเรื่อย ๆ

ถ้า STEP ใดพบว่าของเดิมถูกต้องอยู่แล้ว:

- ห้ามแก้เพื่อให้มีการแก้
- ให้รายงานว่า "ตรวจแล้ว ไม่พบปัญหา"
- เพิ่ม/ปรับ test เฉพาะถ้าจำเป็น
- STOP

ถ้า STEP ใดต้องเปลี่ยน Architecture ใหญ่:

- ห้ามทำเอง
- อธิบายก่อนว่า:
  1. ทำไมต้องเปลี่ยน
  2. ผลกระทบ
  3. ไฟล์ที่จะเปลี่ยน
  4. ทางเลือก
- รอ User อนุมัติ

ถ้าระหว่าง STEP พบปัญหาอื่น:

รายงาน:

"พบปัญหาเพิ่มเติมที่อยู่นอก STEP ปัจจุบัน"

พร้อม:
- file
- problem
- severity
- recommendation

แต่ห้ามแก้เอง


============================================================
END OF ROADMAP
============================================================
ทำตาม step ให้เสร็จ แต่ละ step และ รายงานผล ทีละ step แล้วเริ่มทำงานต่อได้เลย 
โดยที่ ไม่ต้อง ให้เลือกคำถามหรือกดยืนยันอะไรแบบทั้งหมด
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-09-12T16:15:09+07:00.
</ADDITIONAL_METADATA>
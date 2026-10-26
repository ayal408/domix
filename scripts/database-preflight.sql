-- Read-only diagnostics. Run before upgrading; never merge/delete accounts automatically.
SELECT lower(trim("EmailAddress")) AS normalized_email, count(*) AS accounts,
       array_agg("UserId" ORDER BY "UserId") AS account_ids
FROM "Users" WHERE NULLIF(lower(trim("EmailAddress")), '') IS NOT NULL
GROUP BY lower(trim("EmailAddress")) HAVING count(*) > 1;

SELECT "ApartmentId", "ListingType", price, city, address, "Status", "AvailableFrom", "AvailableTo"
FROM "Apartments"
WHERE trim(city) = '' OR trim(address) = '' OR trim(area) = '' OR price < 0
   OR ("ListingType" <> 'Exchange' AND price = 0)
   OR "Status" NOT IN (0,1,2) OR "ListingType" NOT IN ('Unspecified','Exchange','Rent','Sale')
   OR ("ListingType" = 'Exchange' AND ("AvailableFrom" IS NULL OR "AvailableTo" IS NULL
       OR "AvailableTo" <= "AvailableFrom" OR "DesiredCity" IS NULL OR trim("DesiredCity") = ''));

SELECT m."MessageId", m."ApartmentId", m."OfferedApartmentId"
FROM "Messages" m
LEFT JOIN "Apartments" a ON a."ApartmentId" = m."ApartmentId"
LEFT JOIN "Apartments" o ON o."ApartmentId" = m."OfferedApartmentId"
WHERE (m."ApartmentId" IS NOT NULL AND a."ApartmentId" IS NULL)
   OR (m."OfferedApartmentId" IS NOT NULL AND o."ApartmentId" IS NULL);

SELECT d."ClosingDealId", d."idUserBuyer", d."idUserManager" FROM "ClosingDeals" d
LEFT JOIN "Users" b ON b."UserId" = d."idUserBuyer"
LEFT JOIN "Users" m ON m."UserId" = d."idUserManager"
WHERE b."UserId" IS NULL OR m."UserId" IS NULL;

SELECT "UserId", "UserName", "Role", "IsEmailVerified", "IsBlocked"
FROM "Users" WHERE "Role" = 'Admin';

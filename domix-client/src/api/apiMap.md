# DOMIX API Map

This document maps backend controllers, endpoints, DTOs, authentication, and roles for use by the frontend.

## Base URL
- Assumes backend at `/` or configured via environment: `VITE_API_BASE_URL`.

## Auth
- JWT Bearer tokens via `Authorization: Bearer <token>` header.
- Token signing key set in `JWT_SECRET`.
- Claims used: `userId` (GUID), role via `ClaimTypes.Role`.
- Policies: `AdminOnly` used on `api/email/send-test`.

## Controllers & Endpoints

### Auth
- GET `api/auth/{identifier}`
  - Description: Get user by email/username/googleId identifier.
  - Response: `UserResponseDto` or 404.
- POST `api/auth`
  - Description: Register user. Body: `UserDto`.
  - Response: registration result or error.

### User
- GET `api/User/by-id/{userId}` -> `UserResponseDto`
- GET `api/User/by-email/{email}` -> `UserResponseDto`
- GET `api/User/by-username/{username}` -> `UserResponseDto`
- GET `api/User/by-google-id/{googleId}` -> `UserResponseDto`
- POST `api/User` -> create user; Body: `UserDto` -> returns `UserResponseDto`
- PUT `api/User/link-google` -> Body: `LinkGoogleDto` -> returns `User` or 404
- PUT `api/User/link-password` -> Body: `LinkPasswordDto` -> returns `User` or 404
- GET `api/User/lookup?email=&username=&googleId=` -> unified lookup -> `UserResponseDto`
- PUT `api/User/profile-image` (Authorized) -> Body: `UpdateProfileImageDto` -> returns updated `UserResponseDto`

### Apartment
(All endpoints authorized)
- GET `api/Apartment/all` -> List of `ApartmentDTO` (includes images)
- GET `api/Apartment/cities` -> List of cities (string[])
- GET `api/Apartment/Search?city=&minPrice=&maxPrice=&minRooms=&maxRooms=` -> `ApartmentDTO[]`
- POST `api/Apartment` (Authorized) -> Body: `CreateApartmentDTO` -> creates apartment; requires `userId` claim
- PUT `api/Apartment/{id}` (Authorized) -> Body: `UpdateApartmentDTO` -> full replace of the editable fields; 404 if the id doesn't exist, 403 if the caller isn't the owner or Admin/Manager
- DELETE `api/Apartment/{id}` (Authorized) -> 204 on success; 404 if the id doesn't exist, 403 if the caller isn't the owner or Admin/Manager, 409 if related records (e.g. appointments) still reference it

Update/Delete: owners may act on their own listings; `Admin`/`Manager` may act on any listing.

No `GET api/Apartment/{id}`. Fetch a single listing by selecting it out of the
`all`/`Search` result (or the React Query cache for those), not a dedicated call.

DTOs: `ApartmentDTO` includes fields: ApartmentId, UserId, status, price, date, city, area, address, description, SquareMeters, SumOfRooms, SumOfBeds, floor, elevator, dateInsert, Latitude, Longitude, ApartmentImages (list of `ApartmentImageDTO`).
`UpdateApartmentDTO` mirrors `CreateApartmentDTO` (city, address, area, price, description, SquareMeters, SumOfRooms, SumOfBeds, floor, elevator) plus an optional `status` to toggle the listing live/inactive.

### ApartmentImage (Authorized)
- GET `api/ApartmentImage` -> list of `ApartmentImageDTO`
- POST `api/ApartmentImage` -> create image via `ApartmentImageDTO` -> returns created `ApartmentImageDTO`
- POST `api/ApartmentImage/upload` (multipart/form-data) -> `UploadImageDto` (ApartmentId + file) -> returns `ApartmentImageDTO`

### Message (Authorized)
- POST `api/Message` -> Body: `CreateMessageDto` (SenderId, OwnerId, Content) -> returns `MessageResponseDto`
- GET `api/Message/owner/{ownerId}?page=&pageSize=` -> Owner inbox (paginated)
- GET `api/Message/owner/{ownerId}/archived` -> archived messages
- PUT `api/Message/archive/{id}` -> archive
- DELETE `api/Message/{id}` -> delete
- PUT `api/Message/read/{id}` -> mark as read

### Email (AdminOnly)
- POST `api/email/send-test` -> sends test email

### Health
- GET `api/health/db-query` -> checks DB connectivity

## DTO Summaries (frontend types)
- UserDto: { UserName: string, RegistrationMethod: string, PasswordHash?: string, EmailAddress?: string, PhoneNumber?: string, ProfileImageBase64?: string }
- UserResponseDto: { UserId: GUID, UserName: string, RegistrationMethod: string, GoogleId?: string, EmailAddress?: string, PhoneNumber?: string, Role: string, JoiningDate: Date, ProfileColor?: string, ProfileImageBase64?: string }
- ApartmentImageDTO: { ImageId: GUID, ApartmentId: GUID, ImageUrl: string, CreatedAt: Date }
- CreateMessageDto: { SenderId: GUID, OwnerId: GUID, Content: string }
- MessageResponseDto: { MessageId: GUID, SenderId: GUID, SenderName?: string, OwnerId: GUID, OwnerName?: string, Content: string, CreatedAt: Date, IsRead: boolean, ReadAt?: Date, SenderImageBase64?: string, IsDeleted: boolean, IsArchived: boolean, ArchivedAt?: Date, DeletedAt?: Date }
- UploadImageDto (multipart): { ApartmentId: GUID, Image: File }

## Auth & RBAC Notes for Frontend
- The access token itself carries no `role` claim (see `AuthUser`/`AccessTokenClaims`) — the server populates `ClaimTypes.Role` per-request from the DB via `RoleClaimsTransformation`, and the client mirrors this by hydrating `UserResponse.role` from the data API right after sign-in (`stores/auth.store.ts`). Never trust a role read from the JWT client-side; always use `useAuthStore`'s `user.role`/`can()`/`hasRole()`.
- Backend policies `AdminOnly` (`Admin`) and `ManagerOrAdmin` (`Manager`, `Admin`) are registered in `ServiceCollectionExtensions.AddInfrastructure` and mirrored by `POLICY_ROLES` in `types/api.ts`.
- Apartment `Update`/`Delete`: the owner may always act on their own listing; `Admin`/`Manager` may act on any listing (server-enforced — the client should still gate the UI with `ProtectedRoute`/`can()` so non-privileged users aren't shown edit/delete controls on listings they don't own).
- Axios interceptor already adds the `Authorization` header and performs single-flight refresh-and-retry on 401 (`api/http.ts`).

## Next Steps for Frontend Implementation
1. Scaffold TypeScript React app with Vite, Tailwind, i18next, React Query, Zustand, Axios.
2. Create typed API client and Axios interceptors matching JWT scheme.
3. Implement route guards, RBAC checks, and forms wired to DTOs with React Hook Form + Zod.
4. Build pages: Login/Register, Apartments list/search, Apartment details/upload images, Messages (inbox), User profile image update, Admin email test.

---

This file is auto-generated from server code analysis. Use it to implement TypeScript interfaces and API calls.
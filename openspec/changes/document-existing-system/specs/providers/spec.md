# Provider Management Specification

## Overview
Provider management system handles designers, construction companies, and foremen with verification, ratings, and case portfolios.

## ADDED Requirements

### Requirement: Provider Types
The system SHALL support three types of service providers with different characteristics.

#### Scenario: Designer provider registration
- GIVEN a user wants to register as a designer
- WHEN the user submits a merchant application with `providerType=1`
- THEN the system creates a pending MerchantApplication
- AND admin reviews the application
- AND upon approval, creates Provider record with `providerType=1`

#### Scenario: Construction company registration
- GIVEN a company wants to register
- WHEN the company submits application with `providerType=2`
- THEN the system requires company name and license number
- AND validates business license
- AND creates Provider record upon approval

#### Scenario: Foreman registration
- GIVEN a foreman wants to register
- WHEN the foreman submits application with `providerType=3`
- THEN the system creates Provider record
- AND links to worker skills and certifications

### Requirement: Provider Verification
Providers MUST be verified before appearing in search results.

#### Scenario: Admin verifies provider
- GIVEN a pending provider application
- WHEN admin reviews and approves
- THEN the system sets `verified=true`
- AND the provider appears in public listings
- AND sends approval notification

### Requirement: Provider Rating System
Providers SHALL have ratings based on completed projects and reviews.

#### Scenario: Calculate provider rating
- GIVEN a provider with multiple reviews
- WHEN a new review is submitted
- THEN the system recalculates average rating
- AND updates `rating` field (1-5 scale)
- AND updates `reviewCount`

### Requirement: Provider Cases/Portfolio
Providers SHALL be able to showcase their work through case studies.

#### Scenario: Provider uploads case
- GIVEN a verified provider
- WHEN the provider uploads a case with images and description
- THEN the system creates a ProviderCase record
- AND links it to the provider
- AND optionally shows in inspiration feed if `showInInspiration=true`

## Data Models

### Provider
- **ID**: uint64
- **UserID**: uint64 (links to User)
- **ProviderType**: int8 (1:designer, 2:company, 3:foreman)
- **CompanyName**: string
- **LicenseNo**: string
- **Rating**: float32 (0-5)
- **RestoreRate**: float32 (design restoration accuracy)
- **BudgetControl**: float32 (budget control ability)
- **CompletedCnt**: int (completed projects)
- **Verified**: bool
- **Status**: int8 (0:banned, 1:active)
- **Latitude/Longitude**: float64 (location)
- **SubType**: string (personal/studio/company)
- **YearsExperience**: int
- **Specialty**: string (design style/specialty)
- **WorkTypes**: string (for foremen: mason,electrician,etc.)
- **PriceMin/PriceMax**: float64
- **PriceUnit**: string (元/天, 元/平米, etc.)

### ProviderCase
- **ID**: uint64
- **ProviderID**: uint64
- **Title**: string
- **CoverImage**: string (URL)
- **Style**: string (modern, traditional, etc.)
- **Layout**: string (2室1厅, etc.)
- **Area**: string (90㎡, etc.)
- **Price**: float64
- **Year**: string
- **Description**: text
- **Images**: text (JSON array of URLs)
- **ShowInInspiration**: bool

### ProviderReview
- **ID**: uint64
- **ProviderID**: uint64
- **UserID**: uint64
- **Rating**: float32 (1-5)
- **Content**: text
- **Images**: text (JSON array)
- **ServiceType**: string (全包/半包/局部)
- **Tags**: string (JSON array)
- **Reply**: text (provider response)
- **ReplyAt**: timestamp

## API Endpoints

### GET /api/v1/providers
- **Description**: List providers (public)
- **Query Params**: type, verified, lat, lng, radius
- **Response**: Paginated provider list

### GET /api/v1/providers/:id
- **Description**: Get provider details
- **Response**: Provider with cases and reviews

### POST /api/v1/providers/:id/cases
- **Description**: Create provider case
- **Middleware**: JWT (provider only)
- **Request Body**: Case details with images
- **Response**: Created case

### GET /api/v1/providers/:id/reviews
- **Description**: Get provider reviews
- **Query Params**: page, limit
- **Response**: Paginated reviews

### PUT /api/v1/admin/providers/:id/verify
- **Description**: Verify provider (admin only)
- **Middleware**: AdminJWT
- **Request Body**: `{ "verified": true }`
- **Response**: Updated provider

## Business Rules

1. Only verified providers appear in public listings
2. Providers must have at least one case to be featured
3. Rating is calculated as average of all reviews
4. Providers can reply to reviews once
5. Cases can be featured in inspiration feed
6. Location-based search uses lat/lng with radius

## Security Considerations

1. Only provider owners can upload cases
2. Admin approval required for verification
3. Reviews can only be submitted by project owners
4. Sensitive data (license numbers) encrypted at rest

## Dependencies

- User management for provider accounts
- Project management for completed project count
- Review system for ratings
- File storage (OSS) for case images

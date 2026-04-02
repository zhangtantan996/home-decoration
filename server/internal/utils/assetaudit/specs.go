package assetaudit

func DefaultSpecs() []TableSpec {
	return []TableSpec{
		{
			Table: "users",
			PK:    "id",
			Fields: []FieldSpec{
				{Column: "avatar", Mode: FieldModeString},
			},
		},
		{
			Table: "providers",
			PK:    "id",
			Fields: []FieldSpec{
				{Column: "avatar", Mode: FieldModeString},
				{Column: "cover_image", Mode: FieldModeString},
				{Column: "company_album_json", Mode: FieldModeJSON, Paths: []string{"."}},
			},
		},
		{
			Table: "merchant_applications",
			PK:    "id",
			Fields: []FieldSpec{
				{Column: "avatar", Mode: FieldModeString},
				{Column: "id_card_front", Mode: FieldModeString},
				{Column: "id_card_back", Mode: FieldModeString},
				{Column: "license_image", Mode: FieldModeString},
				{Column: "legal_person_id_card_front", Mode: FieldModeString},
				{Column: "legal_person_id_card_back", Mode: FieldModeString},
				{Column: "company_album_json", Mode: FieldModeJSON, Paths: []string{"."}},
				{Column: "portfolio_cases", Mode: FieldModeJSON, Paths: []string{"images"}},
			},
		},
		{
			Table: "merchant_identity_change_applications",
			PK:    "id",
			Fields: []FieldSpec{
				{Column: "application_data", Mode: FieldModeJSON, Paths: []string{
					"avatar",
					"idCardFront",
					"idCardBack",
					"licenseImage",
					"legalPersonIdCardFront",
					"legalPersonIdCardBack",
					"companyAlbum",
					"portfolioCases.images",
					"products.images",
				}},
			},
		},
		{
			Table: "identity_applications",
			PK:    "id",
			Fields: []FieldSpec{
				{Column: "application_data", Mode: FieldModeJSON, Paths: []string{
					"avatar",
					"idCardFront",
					"idCardBack",
					"licenseImage",
					"legalPersonIdCardFront",
					"legalPersonIdCardBack",
					"companyAlbum",
					"portfolioCases.images",
					"products.images",
					"brandLogo",
					"businessLicense",
				}},
			},
		},
		{
			Table: "provider_cases",
			PK:    "id",
			Fields: []FieldSpec{
				{Column: "cover_image", Mode: FieldModeString},
				{Column: "images", Mode: FieldModeJSON, Paths: []string{"."}},
			},
		},
		{
			Table: "case_audits",
			PK:    "id",
			Fields: []FieldSpec{
				{Column: "cover_image", Mode: FieldModeString},
				{Column: "images", Mode: FieldModeJSON, Paths: []string{"."}},
			},
		},
		{
			Table: "material_shop_applications",
			PK:    "id",
			Fields: []FieldSpec{
				{Column: "brand_logo", Mode: FieldModeString},
				{Column: "business_license", Mode: FieldModeString},
				{Column: "legal_person_id_card_front", Mode: FieldModeString},
				{Column: "legal_person_id_card_back", Mode: FieldModeString},
			},
		},
		{
			Table: "material_shop_application_products",
			PK:    "id",
			Fields: []FieldSpec{
				{Column: "images_json", Mode: FieldModeJSON, Paths: []string{"."}},
			},
		},
		{
			Table: "material_shop_products",
			PK:    "id",
			Fields: []FieldSpec{
				{Column: "images_json", Mode: FieldModeJSON, Paths: []string{"."}},
				{Column: "cover_image", Mode: FieldModeString},
			},
		},
		{
			Table: "material_shops",
			PK:    "id",
			Fields: []FieldSpec{
				{Column: "cover", Mode: FieldModeString},
				{Column: "brand_logo", Mode: FieldModeString},
				{Column: "business_license", Mode: FieldModeString},
				{Column: "legal_person_id_card_front", Mode: FieldModeString},
				{Column: "legal_person_id_card_back", Mode: FieldModeString},
			},
		},
		{
			Table: "work_logs",
			PK:    "id",
			Fields: []FieldSpec{
				{Column: "photos", Mode: FieldModeJSON, Paths: []string{"."}},
			},
		},
		{
			Table: "projects",
			PK:    "id",
			Fields: []FieldSpec{
				{Column: "completed_photos", Mode: FieldModeJSON, Paths: []string{"."}},
				{Column: "dispute_evidence", Mode: FieldModeJSON, Paths: []string{"."}},
			},
		},
		{
			Table: "demands",
			PK:    "id",
			Fields: []FieldSpec{
				{Column: "attachments", Mode: FieldModeJSON, Paths: []string{"url"}},
			},
		},
		{
			Table: "complaints",
			PK:    "id",
			Fields: []FieldSpec{
				{Column: "evidence_urls", Mode: FieldModeJSON, Paths: []string{"."}},
			},
		},
		{
			Table: "refund_applications",
			PK:    "id",
			Fields: []FieldSpec{
				{Column: "evidence", Mode: FieldModeJSON, Paths: []string{"."}},
			},
		},
		{
			Table: "after_sales",
			PK:    "id",
			Fields: []FieldSpec{
				{Column: "images", Mode: FieldModeJSON, Paths: []string{"."}},
			},
		},
		{
			Table: "design_working_docs",
			PK:    "id",
			Fields: []FieldSpec{
				{Column: "files", Mode: FieldModeJSON, Paths: []string{".", "url"}},
			},
		},
		{
			Table: "design_deliverables",
			PK:    "id",
			Fields: []FieldSpec{
				{Column: "color_floor_plan", Mode: FieldModeJSON, Paths: []string{"."}},
				{Column: "renderings", Mode: FieldModeJSON, Paths: []string{"."}},
				{Column: "cad_drawings", Mode: FieldModeJSON, Paths: []string{"."}},
				{Column: "attachments", Mode: FieldModeJSON, Paths: []string{"."}},
			},
		},
		{
			Table: "proposals",
			PK:    "id",
			Fields: []FieldSpec{
				{Column: "attachments", Mode: FieldModeJSON, Paths: []string{"."}},
				{Column: "internal_draft_json", Mode: FieldModeJSON, Paths: []string{"attachments", "url"}},
				{Column: "preview_package_json", Mode: FieldModeJSON, Paths: []string{"floorPlanImages", "effectPreviewImages", "effectImages"}},
				{Column: "delivery_package_json", Mode: FieldModeJSON, Paths: []string{"attachments", "floorPlanImages", "effectImages", "images"}},
			},
		},
		{
			Table: "contracts",
			PK:    "id",
			Fields: []FieldSpec{
				{Column: "attachment_urls", Mode: FieldModeJSON, Paths: []string{"."}},
			},
		},
		{
			Table: "provider_reviews",
			PK:    "id",
			Fields: []FieldSpec{
				{Column: "images", Mode: FieldModeJSON, Paths: []string{"."}},
			},
		},
		{
			Table: "user_verifications",
			PK:    "id",
			Fields: []FieldSpec{
				{Column: "id_front_image", Mode: FieldModeString},
				{Column: "id_back_image", Mode: FieldModeString},
			},
		},
		{
			Table: "user_feedbacks",
			PK:    "id",
			Fields: []FieldSpec{
				{Column: "images", Mode: FieldModeJSON, Paths: []string{"."}},
			},
		},
		{
			Table: "merchant_withdraws",
			PK:    "id",
			Fields: []FieldSpec{
				{Column: "transfer_voucher", Mode: FieldModeString},
			},
		},
	}
}

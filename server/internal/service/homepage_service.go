package service

import (
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	imgutil "home-decoration-server/internal/utils/image"
	"sync"
)

type HomepageService struct{}

type HomepageStats struct {
	DesignerCount int64 `json:"designerCount"`
	CompanyCount  int64 `json:"companyCount"`
	ForemanCount  int64 `json:"foremanCount"`
	CaseCount     int64 `json:"caseCount"`
}

type HomepageFeaturedProvider struct {
	ID              uint64  `json:"id"`
	ProviderType    int8    `json:"providerType"`
	CompanyName     string  `json:"companyName"`
	Nickname        string  `json:"nickname"`
	Avatar          string  `json:"avatar"`
	Rating          float32 `json:"rating"`
	ReviewCount     int     `json:"reviewCount"`
	CompletedCnt    int     `json:"completedCnt"`
	YearsExperience int     `json:"yearsExperience"`
	Verified        bool    `json:"verified"`
	Specialty       string  `json:"specialty"`
	SubType         string  `json:"subType"`
	HighlightTags   string  `json:"highlightTags"`
	PriceMin        float64 `json:"priceMin"`
	PriceMax        float64 `json:"priceMax"`
	PriceUnit       string  `json:"priceUnit"`
}

type HomepageMaterialShop struct {
	ID           uint64  `json:"id"`
	Type         string  `json:"type"`
	Name         string  `json:"name"`
	Cover        string  `json:"cover"`
	BrandLogo    string  `json:"brandLogo,omitempty"`
	Rating       float32 `json:"rating"`
	MainProducts string  `json:"mainProducts"`
	Address      string  `json:"address"`
	IsVerified   bool    `json:"isVerified"`
}

type HomepageInspiration struct {
	ID         uint64  `json:"id"`
	Title      string  `json:"title"`
	CoverImage string  `json:"coverImage"`
	Style      string  `json:"style"`
	Layout     string  `json:"layout"`
	Area       string  `json:"area"`
	Price      float64 `json:"price"`
	LikeCount  int64   `json:"likeCount"`
	AuthorName string  `json:"authorName"`
}

type HomepageData struct {
	Stats             HomepageStats              `json:"stats"`
	FeaturedDesigners []HomepageFeaturedProvider `json:"featuredDesigners"`
	FeaturedCompanies []HomepageFeaturedProvider `json:"featuredCompanies"`
	FeaturedForemen   []HomepageFeaturedProvider `json:"featuredForemen"`
	MaterialShops     []HomepageMaterialShop     `json:"materialShops"`
	Inspirations      []HomepageInspiration      `json:"inspirations"`
	HotSearchTerms    []string                   `json:"hotSearchTerms"`
}

func (s *HomepageService) GetHomepageData() (*HomepageData, error) {
	var (
		stats     HomepageStats
		designers []HomepageFeaturedProvider
		companies []HomepageFeaturedProvider
		foremen   []HomepageFeaturedProvider
		shops     []HomepageMaterialShop
		insps     []HomepageInspiration
		wg        sync.WaitGroup
		mu        sync.Mutex
		firstErr  error
	)

	setErr := func(err error) {
		mu.Lock()
		if firstErr == nil {
			firstErr = err
		}
		mu.Unlock()
	}

	wg.Add(6)

	// 1. Stats
	go func() {
		defer wg.Done()
		db := applyVisibleProviderFilter(repository.DB.Model(&model.Provider{}))
		if err := db.Where("provider_type = ?", 1).Count(&stats.DesignerCount).Error; err != nil {
			setErr(err)
			return
		}
		if err := db.Where("provider_type = ?", 2).Count(&stats.CompanyCount).Error; err != nil {
			setErr(err)
			return
		}
		if err := db.Where("provider_type = ?", 3).Count(&stats.ForemanCount).Error; err != nil {
			setErr(err)
			return
		}
		if err := applyVisibleInspirationCaseFilter(repository.DB.Model(&model.ProviderCase{})).Count(&stats.CaseCount).Error; err != nil {
			setErr(err)
			return
		}
	}()

	// 2. Featured designers
	go func() {
		defer wg.Done()
		list, err := s.featuredProviders(1, 8)
		if err != nil {
			setErr(err)
			return
		}
		mu.Lock()
		designers = list
		mu.Unlock()
	}()

	// 3. Featured companies
	go func() {
		defer wg.Done()
		list, err := s.featuredProviders(2, 4)
		if err != nil {
			setErr(err)
			return
		}
		mu.Lock()
		companies = list
		mu.Unlock()
	}()

	// 4. Featured foremen
	go func() {
		defer wg.Done()
		list, err := s.featuredProviders(3, 4)
		if err != nil {
			setErr(err)
			return
		}
		mu.Lock()
		foremen = list
		mu.Unlock()
	}()

	// 5. Material shops
	go func() {
		defer wg.Done()
		list, err := s.featuredMaterialShops(6)
		if err != nil {
			setErr(err)
			return
		}
		mu.Lock()
		shops = list
		mu.Unlock()
	}()

	// 6. Inspirations
	go func() {
		defer wg.Done()
		list, err := s.featuredInspirations(8)
		if err != nil {
			setErr(err)
			return
		}
		mu.Lock()
		insps = list
		mu.Unlock()
	}()

	wg.Wait()

	if firstErr != nil {
		return nil, firstErr
	}

	return &HomepageData{
		Stats:             stats,
		FeaturedDesigners: designers,
		FeaturedCompanies: companies,
		FeaturedForemen:   foremen,
		MaterialShops:     shops,
		Inspirations:      insps,
		HotSearchTerms:    []string{"极简设计", "全案交付", "旧房翻新", "水电改造", "定制柜体", "卫浴主材"},
	}, nil
}

func (s *HomepageService) featuredProviders(providerType int8, limit int) ([]HomepageFeaturedProvider, error) {
	var providers []model.Provider
	db := applyVisibleProviderFilter(repository.DB.Model(&model.Provider{}))
	if err := db.Where("provider_type = ?", providerType).
		Order("rating DESC, review_count DESC, completed_cnt DESC").
		Limit(limit).
		Find(&providers).Error; err != nil {
		return nil, err
	}

	if len(providers) == 0 {
		return []HomepageFeaturedProvider{}, nil
	}

	userIDs := make([]uint64, 0, len(providers))
	for _, p := range providers {
		if p.UserID > 0 {
			userIDs = append(userIDs, p.UserID)
		}
	}
	userMap := make(map[uint64]model.User)
	if len(userIDs) > 0 {
		var users []model.User
		repository.DB.Where("id IN ?", userIDs).Find(&users)
		for _, u := range users {
			userMap[u.ID] = u
		}
	}

	items := make([]HomepageFeaturedProvider, len(providers))
	for i, p := range providers {
		avatar := imgutil.GetFullImageURL(p.CoverImage)
		nickname := p.CompanyName
		if u, ok := userMap[p.UserID]; ok {
			if u.Avatar != "" {
				avatar = imgutil.GetFullImageURL(u.Avatar)
			}
			if u.Nickname != "" {
				nickname = u.Nickname
			}
		}
		items[i] = HomepageFeaturedProvider{
			ID:              p.ID,
			ProviderType:    p.ProviderType,
			CompanyName:     p.CompanyName,
			Nickname:        nickname,
			Avatar:          avatar,
			Rating:          p.Rating,
			ReviewCount:     p.ReviewCount,
			CompletedCnt:    p.CompletedCnt,
			YearsExperience: p.YearsExperience,
			Verified:        p.Verified,
			Specialty:       p.Specialty,
			SubType:         p.SubType,
			HighlightTags:   p.HighlightTags,
			PriceMin:        p.PriceMin,
			PriceMax:        p.PriceMax,
			PriceUnit:       model.ProviderPriceUnitPerSquareMeter,
		}
	}
	return items, nil
}

func (s *HomepageService) featuredMaterialShops(limit int) ([]HomepageMaterialShop, error) {
	var shops []model.MaterialShop
	db := applyVisibleMaterialShopFilter(repository.DB.Model(&model.MaterialShop{}))
	if err := db.Order("rating DESC").Limit(limit).Find(&shops).Error; err != nil {
		return nil, err
	}

	items := make([]HomepageMaterialShop, len(shops))
	for i, shop := range shops {
		items[i] = HomepageMaterialShop{
			ID:           shop.ID,
			Type:         shop.Type,
			Name:         shop.Name,
			Cover:        imgutil.GetFullImageURL(shop.Cover),
			BrandLogo:    imgutil.GetFullImageURL(shop.BrandLogo),
			Rating:       shop.Rating,
			MainProducts: shop.MainProducts,
			Address:      shop.Address,
			IsVerified:   shop.IsVerified,
		}
	}
	return items, nil
}

func (s *HomepageService) featuredInspirations(limit int) ([]HomepageInspiration, error) {
	var cases []model.ProviderCase
	db := applyVisibleInspirationCaseFilter(repository.DB.Model(&model.ProviderCase{}))
	if err := db.Order("provider_cases.created_at DESC").Limit(limit).Find(&cases).Error; err != nil {
		return nil, err
	}

	if len(cases) == 0 {
		return []HomepageInspiration{}, nil
	}

	caseIDs := make([]uint64, len(cases))
	providerIDs := make([]uint64, 0)
	for i, c := range cases {
		caseIDs[i] = c.ID
		if c.ProviderID > 0 {
			providerIDs = append(providerIDs, c.ProviderID)
		}
	}

	inspSvc := &InspirationService{}
	likeCounts := inspSvc.batchGetLikeCounts(caseIDs)
	providers := inspSvc.batchGetProviders(providerIDs)
	providerUserIDs := make([]uint64, 0, len(providers))
	for _, provider := range providers {
		if provider.UserID > 0 {
			providerUserIDs = append(providerUserIDs, provider.UserID)
		}
	}
	providerUsers := inspSvc.batchGetUsers(providerUserIDs)

	items := make([]HomepageInspiration, len(cases))
	for i, c := range cases {
		authorName := "官方"
		if c.ProviderID > 0 {
			if p, ok := providers[c.ProviderID]; ok {
				var providerUser *model.User
				if user, ok := providerUsers[p.UserID]; ok {
					providerUser = &user
				}
				authorName = resolveInspirationAuthorName(p, providerUser)
			}
		}
		items[i] = HomepageInspiration{
			ID:         c.ID,
			Title:      c.Title,
			CoverImage: imgutil.GetFullImageURL(c.CoverImage),
			Style:      c.Style,
			Layout:     c.Layout,
			Area:       c.Area,
			Price:      c.Price,
			LikeCount:  likeCounts[c.ID],
			AuthorName: authorName,
		}
	}
	return items, nil
}

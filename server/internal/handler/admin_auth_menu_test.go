package handler

import (
	"testing"

	"home-decoration-server/internal/model"
)

func TestAdminMenuTreeDeduplicatesVisiblePaths(t *testing.T) {
	menus := []model.SysMenu{
		{ID: 200, ParentID: 170, Title: "变更与结算", Type: 2, Path: "/orders", Sort: 5, Visible: true, Status: 1},
		{ID: 50, ParentID: 0, Title: "项目管理", Type: 1, Path: "/projects", Sort: 40, Visible: true, Status: 1},
		{ID: 51, ParentID: 50, Title: "工地列表", Type: 2, Path: "/projects/list", Sort: 1, Visible: true, Status: 1},
		{ID: 170, ParentID: 0, Title: "报价ERP", Type: 1, Path: "/projects/quotes", Sort: 44, Visible: true, Status: 1},
		{ID: 56, ParentID: 0, Title: "订单控制台", Type: 2, Path: "/orders", Sort: 45, Visible: true, Status: 1},
	}

	tree := buildMenuTree(uniqueAdminMenuNodes(menus), 0)

	if countMenuPath(tree, "/orders") != 1 {
		t.Fatalf("expected exactly one /orders menu, got tree=%#v", tree)
	}
	if findTopLevelTitle(tree, "订单控制台") {
		t.Fatalf("expected legacy top-level order center to be removed from sidebar tree")
	}

	quoteRoot := findMenuByPath(tree, "/projects/quotes")
	if quoteRoot == nil {
		t.Fatalf("expected quote ERP root in sidebar tree")
	}
	if findMenuByPath(quoteRoot.Children, "/orders") == nil {
		t.Fatalf("expected /orders to live under quote ERP root")
	}
}

func countMenuPath(menus []*model.SysMenu, path string) int {
	count := 0
	for _, menu := range menus {
		if menu.Path == path {
			count++
		}
		count += countMenuPath(menu.Children, path)
	}
	return count
}

func findTopLevelTitle(menus []*model.SysMenu, title string) bool {
	for _, menu := range menus {
		if menu.Title == title {
			return true
		}
	}
	return false
}

func findMenuByPath(menus []*model.SysMenu, path string) *model.SysMenu {
	for _, menu := range menus {
		if menu.Path == path {
			return menu
		}
		if child := findMenuByPath(menu.Children, path); child != nil {
			return child
		}
	}
	return nil
}

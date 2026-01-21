export interface PageData<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

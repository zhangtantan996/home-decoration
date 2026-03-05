# Wave 3 Learnings

## Task 7: MerchantLogin.tsx 全面修复

### Changes Applied
1. **Store integration**: Replaced direct `localStorage` writes with `useMerchantAuthStore.getState().login({ token, provider, tinodeToken })`
2. **DEV UI leak fix**: Removed `message.success` with debug code suffix; now uses `console.debug` only in DEV
3. **Timer cleanup**: Implemented `useRef<number | null>` + `useEffect` cleanup to prevent memory leaks
4. **Navigation timing**: Removed all `setTimeout` delays; navigate immediately after message display
5. **Form validation**: Set `validateTrigger="onBlur"` at Form level; removed redundant Item-level overrides
6. **Theme tokens**: Applied `MERCHANT_THEME.pageBgGradient`, `cardWidth`, `cardMaxWidth` for consistency
7. **Error handling**: Narrowed error handling with `MerchantApiError` check before fallback assertion
8. **Input modes**: Already present (`inputMode="numeric"` on both phone and code inputs)

### Verification
- LSP diagnostics: clean
- ESLint: clean (no warnings)
- All business logic branches preserved (409 PENDING/RESUBMIT/CHANGE_ROLE)
- Existing API call behavior unchanged

### Notes
- Removed unnecessary comment "Cleanup timer on unmount" per code quality standards
- Timer ref properly typed and cleaned up on unmount
- Store login method handles all localStorage persistence internally
## Task 7 Final Type-Safety Fix

### Change
Replaced unsafe object-type assertions in error handlers:
- Before: `const maybeAxiosError = error as { response?: { data?: { message?: string } } }`
- After: `axios.isAxiosError(error)` guard with proper narrowing

### Locations
- `handleSendCode` catch block (line ~83-92)
- `onFinish` catch block (line ~140-156)

### Verification
- LSP diagnostics: clean
- ESLint: clean
- Grep for `as { response`: zero matches
- 409 nextAction flow preserved
- All business branches unchanged

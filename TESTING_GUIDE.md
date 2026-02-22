# TypeFlow Caret Style Settings - Testing Guide

## Overview
This guide will help you test all three implemented features for the caret style settings.

---

## Test 1: Caret Style Selection Working

### Objective
Verify that changing the caret style in settings immediately updates the typing test display.

### Steps
1. Navigate to the **Settings** page
2. Scroll to the **Appearance** section
3. Find the **Caret Style** option with three buttons: "line", "block", "underline"
4. Click on **"line"** - you should see a preview of the line caret below
5. Click on **"block"** - the preview should change to a block caret
6. Click on **"underline"** - the preview should change to an underline caret
7. Go back to the **Home** page (typing test area)
8. Start typing - verify the caret matches your selected style
9. Go back to **Settings** and change the style again
10. Return to the typing test - the caret should reflect the new style immediately

### Expected Results
- ✅ Each caret style shows a different visual style in the preview
- ✅ The typing test displays the correct caret style immediately after selection
- ✅ No page reload is needed for changes to apply
- ✅ Settings persist across page navigation

---

## Test 2: Caret Fading When Text Scrolls

### Objective
Verify that when the current line scrolls out of view (above the container), the caret fades to 40% opacity.

### Steps
1. Go to the **Home** page (typing test area)
2. In **Settings**, select a **larger font size** (e.g., "large") for better visibility
3. Start typing and continue to type many characters/words
4. Watch as the text scrolls up within the typing area
5. When the current line moves above the top of the visible typing area:
   - The caret should become noticeably more transparent/faded
   - It should maintain its blinking animation
   - It should still be the same style (line, block, or underline)
6. Continue scrolling to bring that line back into view
7. The caret should return to full opacity (100%)

### Expected Results
- ✅ Caret is at full opacity when visible in the typing area
- ✅ Caret fades to 40% opacity when scrolled above the visible area
- ✅ Blinking animation continues even when faded
- ✅ Fading works for all three caret styles (line, block, underline)
- ✅ Caret returns to full opacity when brought back into view

### Visual Indicators
- **Line Caret Faded**: A semi-transparent left border on the character
- **Block Caret Faded**: A semi-transparent background on the character
- **Underline Caret Faded**: A semi-transparent bottom border on the character

---

## Test 3: Stats Display for Quick/Minimal Tests

### Objective
Verify that all statistics (including stability/consistency and graph) display correctly even when a test is completed very quickly or with minimal input.

### Steps - Test 3a: Ultra-Quick Test (without spacebar)
1. Go to the **Home** page (typing test area)
2. Make sure the test mode is **"time"** with **15 seconds** or longer
3. Click the typing area to start
4. Type just **ONE character** (any key, not spacebar)
5. Immediately click the **"Finish"** button or wait for auto-finish
6. Look at the results page:
   - ✅ WPM card should show a value (not N/A or blank)
   - ✅ Raw WPM should show a value
   - ✅ Accuracy should show a percentage
   - ✅ **Consistency (Stability)** card should show a percentage (not blank)
   - ✅ **WPM Over Time chart** should appear and display data

### Steps - Test 3b: Very Quick Test (just 1-2 seconds)
1. Go to the **Home** page
2. Set mode to **"time"** with **30 seconds**
3. Click and start typing several characters
4. Stop typing after **1-2 seconds**
5. Manually end the test (if applicable)
6. Check results:
   - ✅ All stat cards should be populated
   - ✅ Consistency should have a valid percentage
   - ✅ Chart should show at minimum 1 data point

### Steps - Test 3c: Test Without Pressing Spacebar
1. Set mode to **"words"** with **10 words**
2. Start typing to fill multiple characters but never press spacebar
3. After a few seconds, manually end the test
4. Verify:
   - ✅ Consistency score displays (not empty or 0%)
   - ✅ WPM chart appears with at least one data point
   - ✅ All statistics calculate correctly

### Expected Results
- ✅ All stat cards (WPM, Accuracy, Consistency, Time) show valid numbers
- ✅ Consistency/Stability card always displays a percentage
- ✅ WPM Over Time chart appears with at least 1 data point
- ✅ No error messages or undefined values in the UI
- ✅ Stats calculate correctly regardless of test length or input method
- ✅ Chart shows the WPM progression, even for very short tests

### Common Issues & Solutions

#### Issue: Chart Still Says "wpmHistory.length > 2"
- **Solution**: Update `test-results.tsx` line 164 to use `>= 1` instead of `> 2`

#### Issue: Consistency Shows "NaN" or "undefined"
- **Solution**: Verify `calculateStats()` uses `validWpmHistory` fallback to include at least one WPM value

#### Issue: No Stats Show on Results Page
- **Solution**: Check that the `useEffect` in `use-typing-test.ts` (line 154-159) properly calculates stats when `isFinished` changes

---

## Integration Testing

### Full User Flow Test
1. Open the app
2. Go to **Settings** → Appearance → Change **Caret Style** to "block"
3. Go to **Home** and start a test
4. Type until text scrolls (verify caret fades when scrolled up)
5. Check that caret style is "block" with proper animation
6. Finish the test quickly (after just 1-2 seconds)
7. Verify all stats including consistency and chart appear
8. Change settings to "underline" caret
9. Click "Try Again" 
10. Verify the new caret style is applied
11. Repeat the test and finish quickly again
12. Confirm all stats display properly

### Expected Full Flow Results
- ✅ Settings changes apply immediately without reload
- ✅ Correct caret style displays in active test
- ✅ Caret fades when text scrolls up
- ✅ Quick tests show complete statistics
- ✅ All three caret styles work consistently
- ✅ No console errors or warnings

---

## Debugging Checklist

If tests fail, verify:

- [ ] `SettingsProvider` is wrapped in `app/layout.tsx`
- [ ] `components/typing/typing-area.tsx` uses `useSettings()` hook
- [ ] `app/globals.css` has all caret style classes (line, block, underline)
- [ ] `app/globals.css` has all fade animations (blink-*-faded)
- [ ] `hooks/use-typing-test.ts` calculates stats with `validWpmHistory` fallback
- [ ] `test-results.tsx` shows chart when `wpmHistory.length >= 1`
- [ ] Settings page shows caret preview below the buttons
- [ ] SettingsContext properly updates and persists settings

---

## Performance Notes

- Caret style changes should be instant (no lag)
- Fading should be smooth and not cause performance issues
- Stats calculation should complete immediately on test finish
- No memory leaks from excessive re-renders

---

## Browser Compatibility

Test on:
- ✅ Chrome/Chromium (Latest)
- ✅ Firefox (Latest)
- ✅ Safari (Latest)
- ✅ Edge (Latest)

All CSS animations and context providers should work across all modern browsers.

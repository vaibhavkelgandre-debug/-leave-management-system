import "@testing-library/jest-dom";

// jsdom doesn't implement scrollIntoView at all — several components
// (HolidayList.jsx, MyLeaveRequestList.jsx) call it to bring a
// calendar-selected row into view, which would otherwise throw
// "scrollIntoView is not a function" the moment a test actually exercises
// that selection state.
if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
}
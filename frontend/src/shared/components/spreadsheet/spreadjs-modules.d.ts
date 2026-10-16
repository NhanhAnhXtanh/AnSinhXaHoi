// Các gói add-on SpreadJS chỉ có index.js, không kèm khai báo kiểu. Chúng chỉ được
// import kiểu side-effect (`import "@mescius/spread-sheets-print"`) — khai báo rỗng
// ở đây để TypeScript (noUncheckedSideEffectImports) không báo thiếu module.
declare module "@mescius/spread-sheets-io";
declare module "@mescius/spread-sheets-print";
declare module "@mescius/spread-sheets-shapes";
declare module "@mescius/spread-sheets-datacharts-addon";
declare module "@mescius/spread-sheets-slicers";
declare module "@mescius/spread-sheets-pivot-addon";
declare module "@mescius/spread-sheets-tablesheet";
declare module "@mescius/spread-sheets-ganttsheet";
declare module "@mescius/spread-sheets-reportsheet-addon";
declare module "@mescius/spread-sheets-formula-panel";
declare module "@mescius/spread-sheets-designer-resources-en";

sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/Column",
    "sap/m/Text",
    "sap/m/ColumnListItem"
], (Controller, JSONModel, Column, Text, ColumnListItem) => {
    "use strict";

    return Controller.extend("assetdep.controller.View1", {

        onInit() {
            // Model may not be propagated yet at onInit; defer until route is matched
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteView1").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched() {
            const oModel = this.getView().getModel();
            oModel.read("/ZI_FI_ASSET_DEPRECIATION", {
                success: (oData) => this._buildPivotTable(oData.results)
            });
        },

        /**
         * Pivots the OData records so each unique asset_id becomes a row
         * and each unique column_Heading becomes a dynamic column,
         * then renders the pivot table programmatically.
         * @param {Array} aData - array of OData records
         */
        _buildPivotTable(aData) {

            // Unique column headings in order of first appearance
            const aHeadings = [...new Set(aData.map((r) => r.column_Heading))];

            // Build pivot map: { asset_id -> { column_Heading: value, ... } }
            const oAssetMap = {};
            aData.forEach((r) => {
                if (!oAssetMap[r.asset_id]) {
                    oAssetMap[r.asset_id] = { asset_id: r.asset_id };
                }
                oAssetMap[r.asset_id][r.column_Heading] = r.value;
            });
            const aPivotRows = Object.values(oAssetMap);

            // ── Build pivot table columns ──────────────────────────────────────
            const oPivotTable = this.byId("pivotTable");
            oPivotTable.destroyColumns();

            // Fixed first column: Asset
            oPivotTable.addColumn(new Column({
                width: "150px",
                header: new Text({ text: "Asset" })
            }));

            // One column per unique column_Heading
            aHeadings.forEach((sHeading) => {
                oPivotTable.addColumn(new Column({
                    width: "100px",
                    hAlign: "End",
                    header: new Text({ text: sHeading })
                }));
            });

            // ── Build pivot table rows ─────────────────────────────────────────
            oPivotTable.destroyItems();
            aPivotRows.forEach((oRow) => {
                const aCells = [new Text({ text: oRow.asset_id })];
                aHeadings.forEach((sHeading) => {
                    const sVal = (oRow[sHeading] !== undefined && oRow[sHeading] !== null && oRow[sHeading] !== "")
                        ? String(oRow[sHeading])
                        : "N/A";
                    aCells.push(new Text({ text: sVal }));
                });
                oPivotTable.addItem(new ColumnListItem({ cells: aCells }));
            });
        }
    });
});
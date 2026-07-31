sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/Column",
    "sap/m/Text",
    "sap/ui/comp/valuehelpdialog/ValueHelpDialog",
    "sap/m/Table",
    "sap/m/Token",
    "sap/m/SearchField",
    "sap/ui/comp/filterbar/FilterBar",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/ColumnListItem"
], (Controller, JSONModel, Column, Text, ValueHelpDialog, MTable, Token, SearchField, FilterBar, Filter, FilterOperator, MessageToast, ColumnListItem) => {
    "use strict";

    return Controller.extend("assetdep.controller.View1", {

        onInit() {
            this.byId("keyDateFilter").setMaxDate(new Date());
            // Model may not be propagated yet at onInit; defer until route is matched
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteView1").attachPatternMatched(this._onRouteMatched, this);
            this.byId("assetFilterBar").attachSearch(this.onFilterSearch, this);
            this.byId("assetFilterBar").attachReset(this.onFilterReset, this);
            this.byId("reportTypeGroup").attachSelect(this.onReportTypeSelect, this);
            //end
        },

        _onRouteMatched() {
            this._aSourceData = [];
            this._buildPivotTable(this._aSourceData);
        },

        _loadData() {
            const sFilter = this._getODataFilterExpression();
            this.getView().getModel().read("/ZI_FI_ASSET_DEPRECIATION", {
                urlParameters: sFilter ? { "$filter": sFilter } : {},
                success: (oData) => {
                    this._aSourceData = oData.results;
                    this._buildPivotTable(this._aSourceData);
                },
                error: () => MessageToast.show("Unable to load filtered asset-depreciation data.")
            });
        },

        onValueHelpRequest(oEvent) {
            const mValueHelps = {
                companyCodeFilter: { entitySet: "/ZI_VH_CompanyCode", key: "CompanyCode", description: "CompanyCodeName", searchProperties: ["CompanyCode", "CompanyCodeName"], title: "Select Company Code" },
                ledgerFilter: { entitySet: "/ZI_fi_wip_ledger_f4", key: "Ledger", searchProperties: ["Ledger"], title: "Select Ledger" },
                depreciationAreaFilter: { entitySet: "/ZI_VH_DEPAREA", key: "DepreciationArea", searchProperties: ["CompanyCode", "DepreciationArea"], title: "Select Depreciation Area" }
            };
            const oSource = oEvent.getSource();
            const oConfig = mValueHelps[oSource.getId().split("--").pop()];
            const aFilters = [];
            const aCompanyCodes = this.byId("companyCodeFilter").getTokens().map((oToken) => oToken.getKey());

            if (oConfig.key === "DepreciationArea" && aCompanyCodes.length) {
                aFilters.push(new Filter(aCompanyCodes.map((sCompanyCode) =>
                    new Filter("CompanyCode", FilterOperator.EQ, sCompanyCode)
                ), false));
            }

            this.getView().getModel().read(oConfig.entitySet, {
                filters: aFilters,
                success: (oData) => {
                    const oValueHelpModel = new JSONModel({ items: oData.results });
                    const aColumns = [new Column({ header: new Text({ text: oConfig.title }) })];
                    const aCells = [new Text({ text: "{valueHelp>" + oConfig.key + "}" })];

                    if (oConfig.description) {
                        aColumns.push(new Column({ header: new Text({ text: "Description" }) }));
                        aCells.push(new Text({ text: "{valueHelp>" + oConfig.description + "}" }));
                    }

                    let oDialog;
                    let aResultTokens = [];
                    let bConfirmed = false;
                    const oTable = new MTable({
                        mode: "MultiSelect",
                        columns: aColumns
                    });
                    oTable.setModel(oValueHelpModel, "valueHelp");
                    oTable.bindItems({
                        path: "valueHelp>/items",
                        template: new ColumnListItem({ cells: aCells })
                    });

                    const oBasicSearch = new SearchField();
                    const oFilterBar = new FilterBar({
                        basicSearch: oBasicSearch.getId(),
                        showGoOnFB: true,
                        search: () => {
                            const sQuery = oBasicSearch.getValue();
                            const aSearchFilters = oConfig.searchProperties.map((sProperty) =>
                                new Filter(sProperty, FilterOperator.Contains, sQuery)
                            );
                            oTable.getBinding("items").filter(sQuery ? [new Filter({ filters: aSearchFilters, and: false })] : []);
                        }
                    });

                    oDialog = new ValueHelpDialog({
                        title: oConfig.title,
                        supportMultiselect: true,
                        supportRanges: true,
                        key: oConfig.key,
                        descriptionKey: oConfig.description || oConfig.key,
                        selectionChange: (oSelectionEvent) => {
                            const oTableSelection = oSelectionEvent.getParameter("tableSelectionParams");
                            const oItem = oTableSelection.listItem;
                            if (oItem) {
                                const oRow = oItem.getBindingContext("valueHelp").getObject();
                                oSelectionEvent.getParameter("updateTokens").push({
                                    sKey: oRow[oConfig.key],
                                    oRow,
                                    bSelected: oTableSelection.selected
                                });
                            }
                        },
                        ok: (oOkEvent) => {
                            aResultTokens = oOkEvent.getParameter("tokens").map((oToken) => {
                                const oResultToken = new Token({ key: oToken.getKey(), text: oToken.getText() });
                                if (oToken.data("range")) {
                                    oResultToken.data("range", oToken.data("range"));
                                }
                                return oResultToken;
                            });
                            bConfirmed = true;
                            oDialog.close();
                        },
                        cancel: () => oDialog.close(),
                        afterClose: () => {
                            oDialog.destroy();
                            if (bConfirmed) {
                                setTimeout(() => {
                                    oSource.removeAllTokens();
                                    aResultTokens.forEach((oToken) => oSource.addToken(oToken));
                                    oSource.fireChange({ value: oSource.getValue() });
                                }, 0);
                            }
                        }
                    });
                    oDialog.setRangeKeyFields([{ key: oConfig.key, label: oConfig.title, type: "string" }]);
                    oDialog.setFilterBar(oFilterBar);
                    oDialog.setTable(oTable);
                    oDialog.update();
                    this.getView().addDependent(oDialog);
                    oDialog.open();
                },
                error: () => MessageToast.show("Unable to load value help data.")
            });
        },



        onKeyDateChange(oEvent) {
            if (!oEvent.getParameter("valid")) {
                return;
            }

            const oSelectedDate = oEvent.getSource().getDateValue();
            if (!oSelectedDate) {
                return;
            }

            this.byId("fiscalYearFilter").setValue(String(oSelectedDate.getFullYear()));
            this.byId("toPeriodFilter").setValue(String(oSelectedDate.getMonth() + 1).padStart(3, "0"));
        },


        onFilterSearch() {
            if (this._validateMandatoryFilters()) {
                this._hasExecutedSearch = true;
                this._loadData();
            }
        },

        onReportTypeSelect() {
            if (this._hasExecutedSearch && this._validateMandatoryFilters()) {
                this._loadData();
            }
        },

        _validateMandatoryFilters() {
            const aMandatoryFields = [
                ["companyCodeFilter", "Company Code"],
                ["ledgerFilter", "Ledger"],
                ["depreciationAreaFilter", "Depreciation Area"],
                ["keyDateFilter", "Key Date"],
                ["fiscalYearFilter", "Fisc. Year of Ledger"],
                ["toPeriodFilter", "To Period"],
                ["displayCurrencyFilter", "Display Currency"]
            ];
            const aMissingLabels = aMandatoryFields.filter(([sControlId]) => {
                const oControl = this.byId(sControlId);
                const bHasValue = oControl.getTokens ? oControl.getTokens().length > 0 : Boolean(oControl.getValue().trim());
                oControl.setValueState(bHasValue ? "None" : "Error");
                return !bHasValue;
            }).map(([, sLabel]) => sLabel);

            if (aMissingLabels.length) {
                MessageToast.show("Enter all mandatory fields: " + aMissingLabels.join(", "));
                return false;
            }
            return true;
        },

        onFilterReset() {
            setTimeout(() => {
                this._hasExecutedSearch = false;
                this._aSourceData = [];
                this._buildPivotTable(this._aSourceData);
            }, 0);
        },

        _getODataFilterExpression() {
            const aFieldMappings = [
                ["CompanyCode", "companyCodeFilter"],
                ["ledger", "ledgerFilter"],
                ["DepreciationArea", "depreciationAreaFilter"],
                ["keyDate", "keyDateFilter"],
                ["FiscalYear", "fiscalYearFilter"],
                ["to_period", "toPeriodFilter"],
                ["DepreciationVariant", "depreciationVariantFilter"],
                ["display_currency", "displayCurrencyFilter"],
                ["fixed_asset", "assetIdFilter"],
                ["asset_id", "assetSubnumberFilter"],
                ["asset_class", "assetClassFilter"]
            ];

            const aFilterExpressions = aFieldMappings.map(([sProperty, sControlId]) => {
                const oControl = this.byId(sControlId);
                const aValues = oControl.getTokens ? oControl.getTokens().map((oToken) => oToken.getKey()) : [oControl.getValue().trim()];
                const aExpressions = aValues.filter(Boolean).map((sValue) => {
                    const sLiteral = sProperty === "keyDate"
                        ? "datetime\x27" + sValue + "T00:00:00\x27"
                        : "\x27" + String(sValue).replace(/\x27/g, "\x27\x27") + "\x27";
                    return sProperty + " eq " + sLiteral;
                });
                return aExpressions.length > 1 ? "(" + aExpressions.join(" or ") + ")" : aExpressions[0];
            }).filter(Boolean);
            const sReportType = this.byId("reportTypeGroup").getSelectedButton().getText();
            aFilterExpressions.push("report_type eq \x27" + ({ Monthly: "1", Quarterly: "2", Yearly: "3" })[sReportType] + "\x27");
            return aFilterExpressions.join(" and ");
        },

        _applyFilters(aData) {
            const aFilters = [
                ["fixed_asset", "assetIdFilter"],
                ["CompanyCode", "companyCodeFilter"],
                ["ledger", "ledgerFilter"],
                ["DepreciationArea", "depreciationAreaFilter"],
                ["keyDate", "keyDateFilter"],
                ["FiscalYear", "fiscalYearFilter"]
            ].map(([sProperty, sControlId]) => {
                const oControl = this.byId(sControlId);
                const aValues = oControl.getTokens ? oControl.getTokens().map((oToken) => oToken.getKey()) : [oControl.getValue().trim()];
                return { property: sProperty, values: aValues.filter(Boolean) };
            }).filter((oFilter) => oFilter.values.length);

            return aData.filter((oRecord) => aFilters.every((oFilter) => {
                const vValue = oRecord[oFilter.property];
                return vValue !== undefined && vValue !== null && oFilter.values.some((sValue) =>
                    String(vValue).toLowerCase().includes(sValue.toLowerCase())
                );
            }));
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
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
            this._iPageSize = 50;
            this.byId("keyDateFilter").setMaxDate(new Date());
            this.byId("page").setBusyIndicatorDelay(0);
            // Model may not be propagated yet at onInit; defer until route is matched
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteView1").attachPatternMatched(this._onRouteMatched, this);
            this.byId("assetFilterBar").attachSearch(this.onFilterSearch, this);
            this.byId("assetFilterBar").attachReset(this.onFilterReset, this);
            this.byId("reportTypeGroup").attachSelect(this.onReportTypeSelect, this);
            this.byId("companyCodeFilter").attachChange(this.onCompanyCodeChange, this);
            this.byId("companyCodeFilter").attachTokenUpdate(this.onCompanyCodeChange, this);
            //end
        },

        _onRouteMatched() {
            this._aSourceData = [];
            this._buildPivotTable(this._aSourceData);
            this._loadDisplayCurrencies();
        },

        onCompanyCodeChange() {
            clearTimeout(this._companyCodeUpdateTimer);
            this._companyCodeUpdateTimer = setTimeout(() => this._loadDisplayCurrencies(), 0);
        },

        _loadDisplayCurrencies() {
            const aCompanyCodes = this.byId("companyCodeFilter").getTokens()
                .map((oToken) => oToken.getKey());
            const oCurrencyFilter = this.byId("displayCurrencyFilter");

            if (!aCompanyCodes.length) {
                this.getView().setModel(new JSONModel({ items: [] }), "currency");
                oCurrencyFilter.setSelectedKey("");
                oCurrencyFilter.setValue("");
                return;
            }

            const oCompanyCodeFilter = new Filter(aCompanyCodes.map((sCompanyCode) =>
                new Filter("CompanyCode", FilterOperator.EQ, sCompanyCode)
            ), false);
            this.getView().getModel().read("/ZI_VH_CompanyCode", {
                filters: [oCompanyCodeFilter],
                urlParameters: { "$top": "5000" },
                success: (oData) => {
                    const aCurrentCompanyCodes = this.byId("companyCodeFilter").getTokens()
                        .map((oToken) => oToken.getKey());
                    if (aCurrentCompanyCodes.join("|") !== aCompanyCodes.join("|")) {
                        return;
                    }
                    const aCompanyCurrencies = [...new Set(oData.results
                        .map((oItem) => oItem.Currency)
                        .filter(Boolean))]
                        .sort()
                        .map((sCurrency) => ({
                            Key: sCurrency,
                            Text: sCurrency + " (Company Code Currency)"
                        }));
                    const oGroupCurrency = {
                        Key: "GROUP_USD",
                        Text: "USD (Group Currency)"
                    };
                    this.getView().setModel(new JSONModel({
                        items: [...aCompanyCurrencies, oGroupCurrency]
                    }), "currency");
                    oCurrencyFilter.setSelectedKey("GROUP_USD");
                },
                error: () => MessageToast.show("Unable to load display currencies.")
            });
        },

        _getDisplayCurrencyValue() {
            const sSelectedKey = this.byId("displayCurrencyFilter").getSelectedKey();
            return sSelectedKey === "GROUP_USD" ? "USD" : sSelectedKey;
        },

        _loadData() {
            const sFilter = this._getODataFilterExpression();

            const iRequestId = (this._dataRequestId || 0) + 1;
            const oPage = this.byId("page");
            this._dataRequestId = iRequestId;
            oPage.setBusy(true);

            this.getView().getModel().read("/ZI_FI_ASSET_DEPRECIATION", {
                urlParameters: sFilter ? { "$filter": sFilter } : {},
                success: (oData) => {

                    if (iRequestId !== this._dataRequestId) {
                        return;
                    }

                    this._aSourceData = oData.results;
                    this._buildPivotTable(this._aSourceData);

                    oPage.setBusy(false);

                },
                error: () => {
                    if (iRequestId === this._dataRequestId) {
                        oPage.setBusy(false);
                        MessageToast.show("Unable to load filtered asset-depreciation data.");
                    }
                }
            });
        },

        onValueHelpRequest(oEvent) {
            const mValueHelps = {
                companyCodeFilter: { entitySet: "/ZI_VH_CompanyCode", key: "CompanyCode", description: "CompanyCodeName", searchProperties: ["CompanyCode", "CompanyCodeName"], title: "Select Company Code" },
                ledgerFilter: { entitySet: "/ZI_fi_wip_ledger_f4", key: "Ledger", searchProperties: ["Ledger"], title: "Select Ledger" },
                depreciationAreaFilter: {
                    entitySet: "/ZI_VH_DEPAREA",
                    key: "DepreciationArea",
                    columns: [
                        { property: "CompanyCode", label: "Company Code" },
                        { property: "Ledger", label: "Ledger" },
                        { property: "DepreciationArea", label: "Depreciation Area" },
                        { property: "AssetDepreciationAreaName", label: "Asset Depreciation Area Name" }
                    ],
                    searchProperties: ["CompanyCode", "Ledger", "DepreciationArea", "AssetDepreciationAreaName"],
                    title: "Select Depreciation Area"
                },
                displayCurrencyFilter: {
                    entitySet: "/ZI_VH_CompanyCode",
                    key: "Currency",
                    description: "CompanyCodeName",
                    searchProperties: ["Currency", "CompanyCode", "CompanyCodeName"],
                    title: "Select Display Currency"
                },
                assetClassFilter: {
                    entitySet: "/ZI_VH_ASSET_CLASS",
                    key: "AssetClass",
                    columns: [
                        { property: "AssetClass", label: "Asset Class" },
                        { property: "AssetClassName", label: "Asset Class Name" }
                    ],
                    searchProperties: ["AssetClass", "AssetClassName"],
                    title: "Asset Class"
                },
                assetIdFilter: {
                    entitySet: "/ZI_VH_ASSET",
                    key: "MasterFixedAsset",
                    columns: [
                        { property: "CompanyCode", label: "Company Code" },
                        { property: "MasterFixedAsset", label: "Asset" },
                        { property: "FixedAssetDescription", label: "Description" }
                    ],
                    searchProperties: ["CompanyCode", "MasterFixedAsset", "FixedAssetDescription"],
                    title: "Fixed Asset"
                },
                assetSubnumberFilter: {
                    entitySet: "/ZI_VH_ASSET",
                    key: "FixedAsset",
                    columns: [
                        { property: "CompanyCode", label: "Company Code" },
                        { property: "MasterFixedAsset", label: "Asset" },
                        { property: "FixedAsset", label: "Subnumber" },
                        { property: "FixedAssetDescription", label: "Description" },
                        { property: "AssetClass", label: "Asset Class" }
                    ],
                    searchProperties: ["CompanyCode", "MasterFixedAsset", "FixedAsset", "FixedAssetDescription", "AssetClass"],
                    title: "Asset Subnumber"
                }
            };
            const oSource = oEvent.getSource();
            const oConfig = mValueHelps[oSource.getId().split("--").pop()];
            const aFilters = [];
            const aCompanyCodes = this.byId("companyCodeFilter").getTokens().map((oToken) => oToken.getKey());

            //const aledgerFilter = this.byId("ledgerFilter").getTokens().map((oToken) => oToken.getKey());

            if (["DepreciationArea", "Currency", "MasterFixedAsset", "FixedAsset"].includes(oConfig.key) && aCompanyCodes.length) {
                aFilters.push(new Filter(aCompanyCodes.map((sCompanyCode) =>
                    new Filter("CompanyCode", FilterOperator.EQ, sCompanyCode)
                ), false));
            }

            if (oConfig.key === "DepreciationArea") {
                const aLedgers = this.byId("ledgerFilter").getTokens()
                    .map((oToken) => oToken.getKey());
                if (aLedgers.length) {
                    aFilters.push(new Filter(aLedgers.map((sLedger) =>
                        new Filter("Ledger", FilterOperator.EQ, sLedger)
                    ), false));
                }
            }

            this.getView().getModel().read(oConfig.entitySet, {
                filters: aFilters,
                urlParameters: { "$top": "5000" },
                success: (oData) => {
                    const oValueHelpModel = new JSONModel({ items: oData.results });
                    const aDisplayColumns = oConfig.columns || [
                        { property: oConfig.key, label: oConfig.keyLabel || oConfig.title },
                        ...(oConfig.description ? [{
                            property: oConfig.description,
                            label: oConfig.descriptionLabel || "Description"
                        }] : []),
                        ...(oConfig.additionalColumns || [])
                    ];
                    const aColumns = aDisplayColumns.map(({ label }) =>
                        new Column({ header: new Text({ text: label }) })
                    );
                    const aCells = aDisplayColumns.map(({ property }) =>
                        new Text({ text: "{" + property + "}" })
                    );

                    let oDialog;
                    let aResultTokens = [];
                    let bConfirmed = false;
                    const oTable = new MTable({
                        mode: "MultiSelect",
                        // growing: true,
                        // growingThreshold: 20,
                        // growingScrollToLoad: true,
                        columns: aColumns
                    });
                    oTable.setModel(oValueHelpModel, "valueHelp");
                    // ValueHelpDialog restores selections through the default table context.
                    oTable.setModel(oValueHelpModel);
                    oTable.bindItems({
                        path: "/items",
                        template: new ColumnListItem({ cells: aCells })
                    });

                    const oBasicSearch = new SearchField();
                    const fnSearch = () => {
                        const sQuery = oBasicSearch.getValue();
                        const aSearchFilters = oConfig.searchProperties.map((sProperty) =>
                            new Filter(sProperty, FilterOperator.Contains, sQuery)
                        );
                        oTable.getBinding("items").filter(sQuery
                            ? [new Filter({ filters: aSearchFilters, and: false })]
                            : []);
                    };
                    oBasicSearch.attachSearch(fnSearch);
                    const oFilterBar = new FilterBar({
                        basicSearch: oBasicSearch.getId(),
                        showGoOnFB: true,
                        search: fnSearch
                    });

                    oDialog = new ValueHelpDialog({
                        title: oConfig.title,
                        supportMultiselect: true,
                        supportRanges: true,
                        key: oConfig.key,
                        descriptionKey: oConfig.description || oConfig.key,
                        selectionChange: (oSelectionEvent) => {
                            const oTableSelection = oSelectionEvent.getParameter("tableSelectionParams");
                            // A row click provides `listItem`, while the table select-all
                            // checkbox provides every affected row in `listItems`.
                            const aItems = oTableSelection.listItems ||
                                (oTableSelection.listItem ? [oTableSelection.listItem] : []);
                            const aUpdateTokens = oSelectionEvent.getParameter("updateTokens");

                            aItems.forEach((oItem) => {
                                const oRow = (oItem.getBindingContext("valueHelp") || oItem.getBindingContext()).getObject();
                                aUpdateTokens.push({
                                    sKey: oRow[oConfig.key],
                                    oRow,
                                    bSelected: oTableSelection.selected
                                });
                            });
                        },
                        ok: (oOkEvent) => {
                            aResultTokens = oOkEvent.getParameter("tokens").map((oToken) => {
                                const oResultToken = new Token({ key: oToken.getKey(), text: oToken.getText() });
                                oResultToken.setTooltip(oToken.getText());
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
                    const aInitialTokens = oSource.getTokens().map((oToken) => {
                        const oInitialToken = new Token({ key: oToken.getKey(), text: oToken.getText() });
                        if (oToken.data("range")) {
                            oInitialToken.data("range", oToken.data("range"));
                        }
                        return oInitialToken;
                    });
                    oDialog.setTokens(aInitialTokens);
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
                const bHasValue = oControl.getTokens ? oControl.getTokens().length > 0 : Boolean(sControlId === "displayCurrencyFilter" ? this._getDisplayCurrencyValue() : oControl.getValue().trim());
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
                ["display_currency", "displayCurrencyFilter"],
                ["fixed_asset", "assetIdFilter"],
                ["asset_subclass", "assetSubnumberFilter"],
                ["asset_class", "assetClassFilter"]
            ];

            const aFilterExpressions = aFieldMappings.map(([sProperty, sControlId]) => {
                const oControl = this.byId(sControlId);
                const aValues = oControl.getTokens
                    ? oControl.getTokens().map((oToken) => oToken.getKey())
                    : [sControlId === "displayCurrencyFilter"
                        ? this._getDisplayCurrencyValue()
                        : oControl.getValue().trim()];
                const aExpressions = aValues.filter(Boolean).map((sValue) => {
                    const sLiteral = sProperty === "keyDate"
                        ? "datetime\x27" + sValue + "T00:00:00\x27"
                        : "\x27" + String(sValue).replace(/\x27/g, "\x27\x27") + "\x27";
                    return sProperty + " eq " + sLiteral;
                });
                return aExpressions.length > 1 ? "(" + aExpressions.join(" or ") + ")" : aExpressions[0];
            }).filter(Boolean);
            const sReportType = this.byId("reportTypeGroup").getSelectedButton().getText();
            aFilterExpressions.push("report_type eq \x27" + ({ Monthly: "M", Quarterly: "Q", Yearly: "Y" })[sReportType] + "\x27");
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
                const aValues = oControl.getTokens
                    ? oControl.getTokens().map((oToken) => oToken.getKey())
                    : [sControlId === "displayCurrencyFilter"
                        ? this._getDisplayCurrencyValue()
                        : oControl.getValue().trim()];
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
            this._aPivotRows = aPivotRows;
            this._aHeadings = aHeadings;
            this._iCurrentPage = 1;

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

            this._renderPivotPage();
        },

        onPreviousPage() {
            if (this._iCurrentPage > 1) {
                this._iCurrentPage -= 1;
                this._renderPivotPage();
            }
        },

        onNextPage() {
            const iPageCount = Math.ceil(this._aPivotRows.length / this._iPageSize);
            if (this._iCurrentPage < iPageCount) {
                this._iCurrentPage += 1;
                this._renderPivotPage();
            }
        },

        _renderPivotPage() {
            const iPageSize = this._iPageSize || 50;
            const aPivotRows = this._aPivotRows || [];
            const aHeadings = this._aHeadings || [];
            const iTotalRows = aPivotRows.length;
            const iPageCount = Math.max(1, Math.ceil(iTotalRows / iPageSize));
            this._iCurrentPage = Math.min(Math.max(this._iCurrentPage || 1, 1), iPageCount);

            const iStart = (this._iCurrentPage - 1) * iPageSize;
            const aPageRows = aPivotRows.slice(iStart, iStart + iPageSize);
            const oPivotTable = this.byId("pivotTable");
            oPivotTable.destroyItems();
            aPageRows.forEach((oRow) => {
                const aCells = [new Text({ text: oRow.asset_id })];
                aHeadings.forEach((sHeading) => {
                    const sVal = (oRow[sHeading] !== undefined && oRow[sHeading] !== null && oRow[sHeading] !== "")
                        ? String(oRow[sHeading])
                        : "0";
                    aCells.push(new Text({ text: sVal }));
                });
                oPivotTable.addItem(new ColumnListItem({ cells: aCells }));
            });

            const iFirstRow = iTotalRows ? iStart + 1 : 0;
            const iLastRow = iTotalRows ? iStart + aPageRows.length : 0;
            this.byId("paginationStatus").setText("Showing " + iFirstRow + "–" + iLastRow + " of " + iTotalRows);
            this.byId("previousPageButton").setEnabled(this._iCurrentPage > 1);
            this.byId("nextPageButton").setEnabled(this._iCurrentPage < iPageCount);
        }
    });
});
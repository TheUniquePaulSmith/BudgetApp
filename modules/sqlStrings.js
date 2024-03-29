class monthlyQueries {
    static chargerQuery = "Select Chargers.Name, MONTH(TransDate) Month, YEAR(TransDate) Year, SUM(Amount) Amount from Transactions LEFT JOIN Chargers ON Transactions.ChargerId = Chargers.Id WHERE Flag = 'D' group by Chargers.Name, MONTH(TransDate), YEAR(TransDate) order by Name, Month, Year"
    static chargerQueryTotals = "select count(*) from (select Chargers.Name, MONTH(TransDate) Month, YEAR(TransDate) Year, SUM(Amount) from Transactions LEFT JOIN Chargers ON Transactions.ChargerId = Chargers.Id WHERE Flag = 'D' group by Chargers.Name, MONTH(TransDate), YEAR(TransDate) order by Name, Month, Year) nested"
}

class sqlStrings {

    static monthly = monthlyQueries;

    static transQueryBase = "SELECT \
    tr.Id, ch.Name as Charger, ch1.Name as Owner, TransDate, YEAR(TransDate) Year, PostDate, Amount, Merchant, merch.Name as Company, MerchantCity, MerchantState, ReferenceNumber, Flag, MCode \
    FROM `Transactions` as tr LEFT JOIN Chargers as ch \
    ON tr.ChargerId = ch.Id LEFT JOIN Chargers as ch1 \
    ON ch1.Id = tr.ChargerOwnerId LEFT JOIN Merchants merch \
    ON tr.MerchantId = merch.Id";

    static transQueryCount = "SELECT COUNT(*) AS total FROM Transactions";

    static settingsQuery = "SELECT * FROM Settings LIMIT 1";

    static userQueryBase = "SELECT * FROM Users";

    static insertOOBUserQuery = "INSERT INTO Users (DisplayName, Disabled, PassKeys) VALUES (?, ?, ?)";

    static turnOffOOBQuery = "UPDATE Settings set Data = JSON_SET(Data, \"$.oob_mode\", false);"

    static getUserFidoEntries = "SELECT * from Users where JSON_EXTRACT(PassKeys, \"$.Id\") = ?";

    static getMerchantsQuery = "SELECT * from Merchants"
    
}

module.exports = sqlStrings;
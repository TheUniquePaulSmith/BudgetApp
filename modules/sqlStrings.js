class monthlyQueries {
    static chargerQuery = "Select Chargers.Name, MONTH(TransDate) Month, YEAR(TransDate) Year, SUM(Amount) Amount from Transactions LEFT JOIN Chargers ON Transactions.ChargerId = Chargers.Id WHERE Flag = 'D' group by Chargers.Name, MONTH(TransDate), YEAR(TransDate) order by Name, Month, Year"
    static chargerQueryTotals = "select count(*) from (select Chargers.Name, MONTH(TransDate) Month, YEAR(TransDate) Year, SUM(Amount) from Transactions LEFT JOIN Chargers ON Transactions.ChargerId = Chargers.Id WHERE Flag = 'D' group by Chargers.Name, MONTH(TransDate), YEAR(TransDate) order by Name, Month, Year) nested"
    static merchantQuery = "Select Chargers.Name, Merchants.Name MerchantName, MONTH(TransDate) Month, YEAR(TransDate) Year, SUM(Amount) Amount from Transactions INNER JOIN Chargers ON Transactions.ChargerId = Chargers.Id INNER JOIN Merchants ON Merchants.Id = Transactions.MerchantId WHERE Flag = 'D' group by Chargers.Name, MerchantName, MONTH(TransDate), YEAR(TransDate) order by Name, Month, Year";
}

class yearlyQueries {
    static chargerQuery = "Select Chargers.Name, YEAR(TransDate) Year, SUM(Amount) Amount from Transactions LEFT JOIN Chargers ON Transactions.ChargerId = Chargers.Id WHERE Flag = 'D' group by Chargers.Name, YEAR(TransDate) ORDER BY `Amount` ASC";
    static merchantQuery = "Select Chargers.Name, Merchants.Name MerchantName, YEAR(TransDate) Year, SUM(Amount) Amount from Transactions INNER JOIN Chargers ON Transactions.ChargerId = Chargers.Id INNER JOIN Merchants ON Merchants.Id = Transactions.MerchantId WHERE Flag = 'D' group by Chargers.Name, MerchantName, YEAR(TransDate) order by Name, Year";
}

class sqlStrings {

    static monthly = monthlyQueries;
    static yearly = yearlyQueries;

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

    static findMatchingMerchantQuery = "SELECT \
    MerchantId \
    FROM Transactions \
    where MerchantId is not null \
    AND Merchant = ? \
    limit 1"

    static insertNewTransaction = "INSERT INTO Transactions \
    (ChargerID, ChargerOwnerId, TransDate, PostDate, Amount, Merchant, MerchantId, MerchantCity, MerchantState, ReferenceNumber, Flag) \
    VALUES (?, ?, ?, ?, ?, NULLIF(?, ''), NULLIF(?,''), NULLIF(?,''), NULLIF(?,''), NULLIF(?,''), ?)"

    static getTransactionByRefId = "SELECT ch1.AccountMask charger, ch2.AccountMask actowner, tr.* FROM `Transactions` tr \
	LEFT JOIN Chargers ch1 ON tr.ChargerId = ch1.Id \
    LEFT JOIN Chargers ch2 ON tr.ChargerOwnerId = ch2.Id \
    WHERE ReferenceNumber = ?"

    static getChargers = "SELECT * from Chargers";
    
}

module.exports = sqlStrings;
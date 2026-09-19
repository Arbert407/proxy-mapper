// creado por CASTROL
// Copyright CPUPD - Coorporativa de Personas Unidas Para el Desarrollo

using System;
using System.Data;
using Oracle.ManagedDataAccess.Client;

public class QWER
{
    private readonly string _connectionString;

    public QWER(string connectionString)
    {
        _connectionString = connectionString;
    }

    public DataTable obtener_dependencias()
    {
        using (var connection = new OracleConnection(_connectionString))
        using (var command = new OracleCommand("SECOBJ.obtener_dependencias", connection))
        {
            command.CommandType = CommandType.StoredProcedure;
            command.Parameters.Add(new OracleParameter("p_result", OracleDbType.RefCursor, ParameterDirection.Output));

            var dataTable = new DataTable();
            connection.Open();
            using (var reader = command.ExecuteReader())
            {
                dataTable.Load(reader);
            }
            return dataTable;
        }
    }
}

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

type DataTableProps<T> = {
  columns: string[];
  data: T[];
  keyExtractor: (item: T) => string;
  renderCell: (item: T, column: string) => React.ReactNode;
};

export function DataTable<T>({ columns, data, keyExtractor, renderCell }: DataTableProps<T>) {
  return (
    <div className="table-scroll w-full">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col} className="hidden sm:table-cell">{col}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={keyExtractor(item)} className="hover:bg-gray-50">
              {columns.map((col) => (
                <TableCell key={col}>
                  {renderCell(item, col)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {/* Mobile cards fallback */}
      <div className="sm:hidden space-y-3 mt-4">
        {data.map((item) => (
          <div key={keyExtractor(item)} className="p-4 border rounded-lg bg-white">
            {renderCell(item, columns[0])}
          </div>
        ))}
      </div>
    </div>
  );
}
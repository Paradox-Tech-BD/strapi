import * as React from 'react';
import {
  Page,
  Pagination,
  Table,
  useNotification,
  useAPIErrorHandler,
  Layouts,
} from '@strapi/admin/strapi-admin';
import { Box, Flex, Typography, Button, NumberInput } from '@strapi/design-system';
import { Plus } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { useQuery, useMutation } from 'react-query';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import type { FetchError } from '@strapi/admin/strapi-admin';
import { getTrad } from '../utils';

type InventoryItem = {
  id: number;
  sku: string;
  quantity: number;
  reservedQuantity: number;
  lowStockThreshold: number;
  warehouseLocation?: string;
  product?: { name: string } | null;
};

export function InventoryPage() {
  const { formatMessage } = useIntl();
  const { get, post } = useFetchClient();
  const { toggleNotification } = useNotification();
  const { formatAPIError } = useAPIErrorHandler(getTrad);
  const [page, setPage] = React.useState(1);
  const [adjust, setAdjust] = React.useState<Record<number, string>>({});
  const pageSize = 10;

  const { data, isLoading, error, refetch } = useQuery<{
    results: InventoryItem[];
    pagination: { page: number; pageCount: number };
  }>(
    ['ecommerce-base', 'inventory', page],
    async () => {
      const { data } = await get(`/ecommerce-base/inventory?page=${page}&pageSize=${pageSize}`);
      return data as { results: InventoryItem[]; pagination: { page: number; pageCount: number } };
    },
    {
      onError(err) {
        toggleNotification({
          type: 'warning',
          message: formatAPIError(err as unknown as FetchError),
        });
      },
    }
  );

  const adjustMutation = useMutation(
    async ({ id, delta }: { id: number; delta: number }) =>
      post(`/ecommerce-base/inventory/${id}/adjust`, { delta }),
    {
      onSuccess(_d, { delta }) {
        toggleNotification({
          type: 'success',
          message: formatMessage(
            {
              id: getTrad('inventory.adjusted'),
              defaultMessage: 'Stock {delta, number}',
            },
            { delta }
          ),
        });
        refetch();
      },
      onError(err) {
        toggleNotification({
          type: 'warning',
          message: formatAPIError(err as unknown as FetchError),
        });
      },
    }
  );

  if (isLoading) return <Page.Loading />;
  if (error) return <Page.Error />;

  const items = data?.results ?? [];

  const headers: Table.Header<InventoryItem, object>[] = [
    {
      name: 'product',
      label: formatMessage({ id: getTrad('inventory.product'), defaultMessage: 'Product' }),
      sortable: true,
    },
    {
      name: 'sku',
      label: formatMessage({ id: getTrad('inventory.sku'), defaultMessage: 'SKU' }),
      sortable: true,
    },
    {
      name: 'quantity',
      label: formatMessage({ id: getTrad('inventory.quantity'), defaultMessage: 'Quantity' }),
      sortable: true,
    },
    {
      name: 'reserved',
      label: formatMessage({ id: getTrad('inventory.reserved'), defaultMessage: 'Reserved' }),
      sortable: false,
    },
    {
      name: 'adjust',
      label: formatMessage({ id: getTrad('inventory.adjust'), defaultMessage: 'Adjust' }),
      sortable: false,
    },
  ];

  return (
    <Page.Main>
      <Page.Title>
        {formatMessage({ id: getTrad('plugin.inventory'), defaultMessage: 'Inventory' })}
      </Page.Title>
      <Layouts.Header
        title={formatMessage({ id: getTrad('plugin.inventory'), defaultMessage: 'Inventory' })}
        subtitle={formatMessage({
          id: getTrad('inventory.subtitle'),
          defaultMessage: 'Stock ledger across all products',
        })}
      />
      <Layouts.Content>
        <Table.Root rows={items} headers={headers} isLoading={isLoading}>
          <Table.Content>
            <Table.Head>
              {headers.map((header) => (
                <Table.HeaderCell key={header.name} {...header} />
              ))}
            </Table.Head>
            <Table.Empty />
            <Table.Loading />
            <Table.Body>
              {items.map((item) => (
                <Table.Row key={item.id}>
                  {headers.map((header) => {
                    switch (header.name) {
                      case 'product':
                        return (
                          <Table.Cell key={header.name}>{item.product?.name ?? '—'}</Table.Cell>
                        );
                      case 'sku':
                        return (
                          <Table.Cell key={header.name}>
                            <Typography>
                              {item.sku}
                              {item.quantity <= item.lowStockThreshold && item.quantity >= 0
                                ? ' ⚠'
                                : ''}
                            </Typography>
                          </Table.Cell>
                        );
                      case 'quantity':
                        return <Table.Cell key={header.name}>{item.quantity}</Table.Cell>;
                      case 'reserved':
                        return <Table.Cell key={header.name}>{item.reservedQuantity}</Table.Cell>;
                      case 'adjust':
                        return (
                          <Table.Cell key={header.name}>
                            <Flex gap={2}>
                              <NumberInput
                                size="S"
                                value={Number(adjust[item.id] ?? 0)}
                                onValueChange={(v) =>
                                  setAdjust((s) => ({ ...s, [item.id]: String(v) }))
                                }
                                aria-label="Delta"
                              />
                              <Button
                                size="S"
                                startIcon={<Plus />}
                                onClick={() =>
                                  adjustMutation.mutate({
                                    id: item.id,
                                    delta: Number(adjust[item.id] ?? 0),
                                  })
                                }
                              >
                                {formatMessage({
                                  id: getTrad('inventory.apply'),
                                  defaultMessage: 'Apply',
                                })}
                              </Button>
                            </Flex>
                          </Table.Cell>
                        );
                      default:
                        return <Table.Cell key={header.name} />;
                    }
                  })}
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.Root>
        {items.length === 0 && !isLoading && (
          <Box padding={8} background="neutral0" shadow="tableShadow" hasRadius marginTop={4}>
            <Typography textColor="neutral600">
              {formatMessage({
                id: getTrad('inventory.empty'),
                defaultMessage: 'No inventory tracked yet.',
              })}
            </Typography>
          </Box>
        )}
        {(data?.pagination?.pageCount ?? 0) > 1 && (
          <Flex justifyContent="flex-end" marginTop={4}>
            <Pagination.Root {...data!.pagination}>
              <Pagination.Links />
            </Pagination.Root>
          </Flex>
        )}
      </Layouts.Content>
    </Page.Main>
  );
}

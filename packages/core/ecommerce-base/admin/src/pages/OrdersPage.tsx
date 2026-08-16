import * as React from 'react';
import {
  Page,
  Pagination,
  Table,
  useNotification,
  useAPIErrorHandler,
  Layouts,
} from '@strapi/admin/strapi-admin';
import { Box, Flex, Typography, IconButton } from '@strapi/design-system';
import { Trash } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { useQuery, useMutation } from 'react-query';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import type { FetchError } from '@strapi/admin/strapi-admin';
import { getTrad } from '../utils';

type Order = {
  id: number;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  currency: string;
  createdAt: string;
  customer?: { firstName: string; lastName?: string } | null;
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'secondary600',
  confirmed: 'primary600',
  processing: 'primary600',
  shipped: 'alternative600',
  delivered: 'success600',
  cancelled: 'danger600',
  refunded: 'danger600',
};

export function OrdersPage() {
  const { formatMessage } = useIntl();
  const { get, post } = useFetchClient();
  const { toggleNotification } = useNotification();
  const { formatAPIError } = useAPIErrorHandler(getTrad);
  const [page, setPage] = React.useState(1);
  const pageSize = 10;

  const { data, isLoading, error, refetch } = useQuery<{
    results: Order[];
    pagination: { page: number; pageCount: number };
  }>(
    ['ecommerce-base', 'orders', page],
    async () => {
      const { data } = await get(`/ecommerce-base/orders?page=${page}&pageSize=${pageSize}`);
      return data as { results: Order[]; pagination: { page: number; pageCount: number } };
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

  const cancelMutation = useMutation(
    async (id: number) => post(`/ecommerce-base/orders/${id}/cancel`),
    {
      onSuccess() {
        toggleNotification({
          type: 'success',
          message: formatMessage({
            id: getTrad('orders.cancelled'),
            defaultMessage: 'Order cancelled',
          }),
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

  const orders = data?.results ?? [];

  const headers: Table.Header<Order, object>[] = [
    {
      name: 'orderNumber',
      label: formatMessage({ id: getTrad('orders.number'), defaultMessage: 'Order' }),
      sortable: true,
    },
    {
      name: 'customer',
      label: formatMessage({ id: getTrad('orders.customer'), defaultMessage: 'Customer' }),
      sortable: false,
    },
    {
      name: 'status',
      label: formatMessage({ id: getTrad('orders.status'), defaultMessage: 'Status' }),
      sortable: true,
    },
    {
      name: 'total',
      label: formatMessage({ id: getTrad('orders.total'), defaultMessage: 'Total' }),
      sortable: true,
    },
    {
      name: 'actions',
      label: formatMessage({ id: getTrad('orders.actions'), defaultMessage: 'Actions' }),
      sortable: false,
    },
  ];

  return (
    <Page.Main>
      <Page.Title>
        {formatMessage({ id: getTrad('plugin.orders'), defaultMessage: 'Orders' })}
      </Page.Title>
      <Layouts.Header
        title={formatMessage({ id: getTrad('plugin.orders'), defaultMessage: 'Orders' })}
        subtitle={formatMessage({
          id: getTrad('orders.subtitle'),
          defaultMessage: 'Manage customer orders',
        })}
      />
      <Layouts.Content>
        <Table.Root rows={orders} headers={headers} isLoading={isLoading}>
          <Table.Content>
            <Table.Head>
              {headers.map((header) => (
                <Table.HeaderCell key={header.name} {...header} />
              ))}
            </Table.Head>
            <Table.Empty />
            <Table.Loading />
            <Table.Body>
              {orders.map((order) => (
                <Table.Row key={order.id}>
                  {headers.map((header) => {
                    switch (header.name) {
                      case 'orderNumber':
                        return (
                          <Table.Cell key={header.name}>
                            <Typography fontWeight="bold">#{order.orderNumber}</Typography>
                          </Table.Cell>
                        );
                      case 'customer':
                        return (
                          <Table.Cell key={header.name}>
                            {order.customer
                              ? `${order.customer.firstName} ${order.customer.lastName ?? ''}`.trim()
                              : '—'}
                          </Table.Cell>
                        );
                      case 'status':
                        return (
                          <Table.Cell key={header.name}>
                            <Typography textColor={STATUS_COLORS[order.status] ?? 'neutral800'}>
                              {order.status}
                            </Typography>
                          </Table.Cell>
                        );
                      case 'total':
                        return (
                          <Table.Cell key={header.name}>
                            {`${order.currency} ${Number(order.total).toFixed(2)}`}
                          </Table.Cell>
                        );
                      case 'actions':
                        return (
                          <Table.Cell key={header.name}>
                            <Flex gap={1}>
                              <IconButton
                                onClick={() => cancelMutation.mutate(order.id)}
                                label={formatMessage({
                                  id: getTrad('orders.cancel'),
                                  defaultMessage: 'Cancel order',
                                })}
                                aria-label="Cancel order"
                              >
                                <Trash />
                              </IconButton>
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
        {orders.length === 0 && !isLoading && (
          <Box padding={8} background="neutral0" shadow="tableShadow" hasRadius marginTop={4}>
            <Typography textColor="neutral600">
              {formatMessage({ id: getTrad('orders.empty'), defaultMessage: 'No orders yet.' })}
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

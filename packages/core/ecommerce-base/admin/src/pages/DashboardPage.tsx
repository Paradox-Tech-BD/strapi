import * as React from 'react';
import { Page, useNotification, useAPIErrorHandler, Layouts } from '@strapi/admin/strapi-admin';
import { Box, Flex, Typography, Grid } from '@strapi/design-system';
import { ShoppingCart, Briefcase, ChartPie, Gift } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { useQuery } from 'react-query';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import type { FetchError } from '@strapi/admin/strapi-admin';
import { getTrad } from '../utils';

type DashboardStats = {
  orders: {
    totalOrders: number;
    paidOrders: number;
    revenue: number;
    byStatus: Record<string, number>;
  };
  publishedProducts: number;
  customers: number;
  abandonedCarts: number;
  lowStockCount: number;
};

export function DashboardPage() {
  const { formatMessage } = useIntl();
  const { get } = useFetchClient();
  const { toggleNotification } = useNotification();
  const { formatAPIError } = useAPIErrorHandler(getTrad);

  const { data, isLoading, error } = useQuery<DashboardStats>(
    ['ecommerce-base', 'dashboard-stats'],
    async () => {
      const { data } = await get('/ecommerce-base/dashboard/stats');
      return data as DashboardStats;
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

  if (isLoading) return <Page.Loading />;
  if (error) return <Page.Error />;

  const stats = data!;

  const kpis = [
    {
      icon: ShoppingCart,
      label: formatMessage({ id: getTrad('dashboard.revenue'), defaultMessage: 'Revenue' }),
      value: `$${(stats.orders?.revenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    },
    {
      icon: Briefcase,
      label: formatMessage({ id: getTrad('dashboard.orders'), defaultMessage: 'Orders' }),
      value: String(stats.orders?.totalOrders ?? 0),
    },
    {
      icon: ChartPie,
      label: formatMessage({
        id: getTrad('dashboard.products'),
        defaultMessage: 'Published products',
      }),
      value: String(stats.publishedProducts ?? 0),
    },
    {
      icon: Gift,
      label: formatMessage({ id: getTrad('dashboard.customers'), defaultMessage: 'Customers' }),
      value: String(stats.customers ?? 0),
    },
  ];

  return (
    <Page.Main>
      <Page.Title>
        {formatMessage({ id: getTrad('plugin.name'), defaultMessage: 'E-commerce' })}
      </Page.Title>
      <Layouts.Header
        title={formatMessage({ id: getTrad('dashboard.title'), defaultMessage: 'Dashboard' })}
        subtitle={formatMessage({
          id: getTrad('dashboard.subtitle'),
          defaultMessage: 'Overview of your store activity',
        })}
      />
      <Layouts.Content>
        <Grid.Root gap={4}>
          {kpis.map((kpi) => (
            <Grid.Item key={kpi.label} col={3} s={12} xs={12}>
              <Box
                padding={6}
                background="neutral0"
                shadow="tableShadow"
                hasRadius
                aria-label={kpi.label}
              >
                <Flex direction="column" alignItems="start" gap={2}>
                  <Flex alignItems="center" gap={2}>
                    <kpi.icon aria-hidden width={18} height={18} fill="neutral600" />
                    <Typography variant="sigma" textColor="neutral600">
                      {kpi.label}
                    </Typography>
                  </Flex>
                  <Typography variant="alpha" fontWeight="bold">
                    {kpi.value}
                  </Typography>
                </Flex>
              </Box>
            </Grid.Item>
          ))}
        </Grid.Root>

        <Grid.Root gap={4} marginTop={6}>
          <Grid.Item col={6} s={12}>
            <Box padding={6} background="neutral0" shadow="tableShadow" hasRadius>
              <Typography variant="delta" fontWeight="bold" marginBottom={4}>
                {formatMessage({
                  id: getTrad('dashboard.orderStatus'),
                  defaultMessage: 'Orders by status',
                })}
              </Typography>
              <Flex direction="column" gap={2}>
                {Object.entries(stats.orders?.byStatus ?? {}).map(([status, count]) => (
                  <Flex key={status} justifyContent="space-between">
                    <Typography>{status}</Typography>
                    <Typography fontWeight="bold">{count}</Typography>
                  </Flex>
                ))}
                {Object.keys(stats.orders?.byStatus ?? {}).length === 0 && (
                  <Typography textColor="neutral600">
                    {formatMessage({
                      id: getTrad('dashboard.noOrders'),
                      defaultMessage: 'No orders yet',
                    })}
                  </Typography>
                )}
              </Flex>
            </Box>
          </Grid.Item>
          <Grid.Item col={6} s={12}>
            <Box padding={6} background="neutral0" shadow="tableShadow" hasRadius>
              <Typography variant="delta" fontWeight="bold" marginBottom={4}>
                {formatMessage({ id: getTrad('dashboard.health'), defaultMessage: 'Store health' })}
              </Typography>
              <Flex direction="column" gap={2}>
                <Flex justifyContent="space-between">
                  <Typography>
                    {formatMessage({
                      id: getTrad('dashboard.abandonedCarts'),
                      defaultMessage: 'Abandoned carts',
                    })}
                  </Typography>
                  <Typography fontWeight="bold">{stats.abandonedCarts ?? 0}</Typography>
                </Flex>
                <Flex justifyContent="space-between">
                  <Typography>
                    {formatMessage({
                      id: getTrad('dashboard.lowStock'),
                      defaultMessage: 'Low stock alerts',
                    })}
                  </Typography>
                  <Typography fontWeight="bold">{stats.lowStockCount ?? 0}</Typography>
                </Flex>
              </Flex>
            </Box>
          </Grid.Item>
        </Grid.Root>
      </Layouts.Content>
    </Page.Main>
  );
}

import * as React from 'react';
import {
  Page,
  Pagination,
  Table,
  useNotification,
  useAPIErrorHandler,
  Layouts,
} from '@strapi/admin/strapi-admin';
import { Box, Flex, Typography, Badge, IconButton } from '@strapi/design-system';
import { CheckCircle } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { useQuery, useMutation } from 'react-query';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import type { FetchError } from '@strapi/admin/strapi-admin';
import { getTrad } from '../utils';

type Product = {
  id: number;
  name: string;
  sku?: string;
  price: number;
  currency: string;
  status: 'draft' | 'published' | 'archived';
};

export function CatalogPage() {
  const { formatMessage } = useIntl();
  const { get, post } = useFetchClient();
  const { toggleNotification } = useNotification();
  const { formatAPIError } = useAPIErrorHandler(getTrad);
  const [page, setPage] = React.useState(1);
  const pageSize = 10;

  const { data, isLoading, error, refetch } = useQuery<{
    results: Product[];
    pagination: { page: number; pageCount: number };
  }>(
    ['ecommerce-base', 'products', page],
    async () => {
      const { data } = await get(`/ecommerce-base/products?page=${page}&pageSize=${pageSize}`);
      return data as { results: Product[]; pagination: { page: number; pageCount: number } };
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

  const publishMutation = useMutation(
    async (id: number) => post(`/ecommerce-base/products/${id}/publish`),
    {
      onSuccess() {
        toggleNotification({
          type: 'success',
          message: formatMessage({
            id: getTrad('catalog.published'),
            defaultMessage: 'Product published',
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

  const products = data?.results ?? [];

  const headers: Table.Header<Product, object>[] = [
    {
      name: 'name',
      label: formatMessage({ id: getTrad('catalog.name'), defaultMessage: 'Name' }),
      sortable: true,
    },
    {
      name: 'sku',
      label: formatMessage({ id: getTrad('catalog.sku'), defaultMessage: 'SKU' }),
      sortable: true,
    },
    {
      name: 'price',
      label: formatMessage({ id: getTrad('catalog.price'), defaultMessage: 'Price' }),
      sortable: true,
    },
    {
      name: 'status',
      label: formatMessage({ id: getTrad('catalog.status'), defaultMessage: 'Status' }),
      sortable: true,
    },
    {
      name: 'actions',
      label: formatMessage({ id: getTrad('catalog.actions'), defaultMessage: 'Actions' }),
      sortable: false,
    },
  ];

  return (
    <Page.Main>
      <Page.Title>
        {formatMessage({ id: getTrad('plugin.catalog'), defaultMessage: 'Catalog' })}
      </Page.Title>
      <Layouts.Header
        title={formatMessage({ id: getTrad('plugin.catalog'), defaultMessage: 'Catalog' })}
        subtitle={formatMessage({
          id: getTrad('catalog.subtitle'),
          defaultMessage: 'Products and campaigns',
        })}
      />
      <Layouts.Content>
        <Table.Root rows={products} headers={headers} isLoading={isLoading}>
          <Table.Content>
            <Table.Head>
              {headers.map((header) => (
                <Table.HeaderCell key={header.name} {...header} />
              ))}
            </Table.Head>
            <Table.Empty />
            <Table.Loading />
            <Table.Body>
              {products.map((product) => (
                <Table.Row key={product.id}>
                  {headers.map((header) => {
                    switch (header.name) {
                      case 'name':
                        return (
                          <Table.Cell key={header.name}>
                            <Typography fontWeight="bold">{product.name}</Typography>
                          </Table.Cell>
                        );
                      case 'sku':
                        return <Table.Cell key={header.name}>{product.sku ?? '—'}</Table.Cell>;
                      case 'price':
                        return (
                          <Table.Cell key={header.name}>
                            {`${product.currency} ${Number(product.price).toFixed(2)}`}
                          </Table.Cell>
                        );
                      case 'status':
                        return (
                          <Table.Cell key={header.name}>
                            <Badge>{product.status}</Badge>
                          </Table.Cell>
                        );
                      case 'actions':
                        return (
                          <Table.Cell key={header.name}>
                            <Flex gap={1}>
                              {product.status !== 'published' && (
                                <IconButton
                                  onClick={() => publishMutation.mutate(product.id)}
                                  label={formatMessage({
                                    id: getTrad('catalog.publish'),
                                    defaultMessage: 'Publish',
                                  })}
                                  aria-label="Publish product"
                                >
                                  <CheckCircle />
                                </IconButton>
                              )}
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
        {products.length === 0 && !isLoading && (
          <Box padding={8} background="neutral0" shadow="tableShadow" hasRadius marginTop={4}>
            <Typography textColor="neutral600">
              {formatMessage({ id: getTrad('catalog.empty'), defaultMessage: 'No products yet.' })}
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

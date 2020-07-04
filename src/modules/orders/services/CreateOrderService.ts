import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProductRequest {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProductRequest[];
}

interface IProduct {
  product_id: string;
  quantity: number;
  price: number;
}

interface IProductTemp {
  [key: string]: IProduct;
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);
    if (!customer) {
      throw new AppError('Customer not found');
    }

    const productsFetch = await this.productsRepository.findAllById(products);
    if (!productsFetch) {
      throw new AppError('Products not found');
    }
    if (productsFetch.length !== products.length) {
      throw new AppError('Missing products');
    }
    const productsObj: IProductTemp = products.reduce(
      (obj, product) => ({
        ...obj,
        ...{
          [product.id]: {
            product_id: product.id,
            price: 0,
            quantity: product.quantity,
          },
        },
      }),
      {},
    );

    const productsPurchased = productsFetch.map(item => {
      const prod = productsObj[item.id];
      prod.price = item.price;

      if (prod.quantity > item.quantity) {
        throw new AppError(
          `The ${item.name} does not have the quantity enough to be purchased`,
        );
      }

      return prod;
    });

    const order = this.ordersRepository.create({
      customer,
      products: productsPurchased,
    });

    await this.productsRepository.updateQuantity(products);
    return order;
  }
}

export default CreateOrderService;

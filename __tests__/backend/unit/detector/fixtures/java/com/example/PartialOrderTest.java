package com.example;

import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class PartialOrderTest {

    @Test
    @Order(1)
    public void setup() {}

    @Test
    @Order(2)
    public void verify() {}
}

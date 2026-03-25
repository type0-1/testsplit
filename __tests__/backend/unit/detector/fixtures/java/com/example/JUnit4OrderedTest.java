package com.example;

import org.junit.FixMethodOrder;
import org.junit.Test;
import org.junit.runners.MethodSorters;

@FixMethodOrder(MethodSorters.NAME_ASCENDING)
public class JUnit4OrderedTest {

    @Test
    public void zebra() {}

    @Test
    public void apple() {}

    @Test
    public void mango() {}
}
